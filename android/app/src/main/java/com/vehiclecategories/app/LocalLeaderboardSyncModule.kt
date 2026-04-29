package com.vehiclecategories.app

import android.content.Context
import android.net.wifi.WifiManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

class LocalLeaderboardSyncModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val isRunning = AtomicBoolean(false)
  private val receivedSnapshots = ConcurrentLinkedQueue<String>()
  private var serverSocket: ServerSocket? = null
  private var serverThread: Thread? = null
  private var activePort = DEFAULT_PORT

  override fun getName(): String = NAME

  @ReactMethod
  fun startServer(port: Double, promise: Promise) {
    if (isRunning.get()) {
      promise.resolve(buildStatusMap())
      return
    }

    val requestedPort = port.toInt().takeIf { it in 1024..65535 } ?: DEFAULT_PORT

    try {
      val socket = ServerSocket().apply {
        reuseAddress = true
        bind(InetSocketAddress(requestedPort))
      }
      serverSocket = socket
      activePort = requestedPort
      isRunning.set(true)

      serverThread = Thread({ acceptLoop(socket) }, "TKO-Leaderboard-Wifi-Receiver").apply {
        isDaemon = true
        start()
      }

      promise.resolve(buildStatusMap())
    } catch (error: Exception) {
      isRunning.set(false)
      serverSocket = null
      promise.reject("LOCAL_SYNC_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopServer(promise: Promise) {
    stopServerInternal()
    promise.resolve(buildStatusMap())
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(buildStatusMap())
  }

  @ReactMethod
  fun getWifiIpAddress(promise: Promise) {
    promise.resolve(getLocalIpv4Address())
  }

  @ReactMethod
  fun drainReceivedSnapshots(promise: Promise) {
    val payloads = Arguments.createArray()

    while (true) {
      val payload = receivedSnapshots.poll() ?: break
      payloads.pushString(payload)
    }

    promise.resolve(payloads)
  }

  override fun invalidate() {
    stopServerInternal()
    super.invalidate()
  }

  private fun acceptLoop(socket: ServerSocket) {
    while (isRunning.get()) {
      try {
        val client = socket.accept()
        Thread({ handleClient(client) }, "TKO-Leaderboard-Wifi-Client").apply {
          isDaemon = true
          start()
        }
      } catch (_: Exception) {
        if (isRunning.get()) {
          stopServerInternal()
        }
      }
    }
  }

  private fun handleClient(client: Socket) {
    client.use { socket ->
      socket.soTimeout = REQUEST_TIMEOUT_MS
      val input = BufferedInputStream(socket.getInputStream())
      val output = BufferedOutputStream(socket.getOutputStream())
      val requestLine = readAsciiLine(input) ?: run {
        writeJsonResponse(output, 400, """{"ok":false,"error":"Missing request line"}""")
        return
      }
      val requestParts = requestLine.split(" ")
      val method = requestParts.getOrNull(0)?.uppercase(Locale.US) ?: ""
      val path = requestParts.getOrNull(1)?.substringBefore("?") ?: "/"
      val headers = mutableMapOf<String, String>()

      while (true) {
        val line = readAsciiLine(input) ?: break
        if (line.isEmpty()) {
          break
        }

        val separatorIndex = line.indexOf(':')
        if (separatorIndex > 0) {
          headers[line.substring(0, separatorIndex).trim().lowercase(Locale.US)] =
            line.substring(separatorIndex + 1).trim()
        }
      }

      when {
        method == "OPTIONS" -> writeJsonResponse(output, 204, "")
        method == "GET" && (path == "/" || path == "/health" || path == "/api/leaderboard") ->
          writeJsonResponse(
            output,
            200,
            """{"ok":true,"service":"tko-local-leaderboard-sync","pendingCount":${receivedSnapshots.size}}"""
          )
        method == "POST" && isLeaderboardPostPath(path) -> {
          val contentLength = headers["content-length"]?.toIntOrNull() ?: 0
          if (contentLength <= 0 || contentLength > MAX_BODY_BYTES) {
            writeJsonResponse(output, 400, """{"ok":false,"error":"Invalid payload size"}""")
            return
          }

          val bodyBytes = ByteArray(contentLength)
          var offset = 0
          while (offset < contentLength) {
            val read = input.read(bodyBytes, offset, contentLength - offset)
            if (read < 0) {
              break
            }
            offset += read
          }

          if (offset != contentLength) {
            writeJsonResponse(output, 400, """{"ok":false,"error":"Incomplete payload"}""")
            return
          }

          receivedSnapshots.add(String(bodyBytes, Charsets.UTF_8))
          writeJsonResponse(
            output,
            200,
            """{"ok":true,"saved":true,"pendingCount":${receivedSnapshots.size}}"""
          )
        }
        else -> writeJsonResponse(output, 404, """{"ok":false,"error":"Route not found"}""")
      }
    }
  }

  private fun isLeaderboardPostPath(path: String): Boolean =
    path == "/leaderboard" || path == "/api/leaderboard" || path == "/api/leaderboard-sync"

  private fun readAsciiLine(input: BufferedInputStream): String? {
    val bytes = ArrayList<Byte>()

    while (true) {
      val value = input.read()
      if (value < 0) {
        return if (bytes.isEmpty()) null else bytes.toByteArray().toString(Charsets.US_ASCII)
      }

      if (value == '\n'.code) {
        if (bytes.isNotEmpty() && bytes.last() == '\r'.code.toByte()) {
          bytes.removeAt(bytes.size - 1)
        }
        return bytes.toByteArray().toString(Charsets.US_ASCII)
      }

      bytes.add(value.toByte())
      if (bytes.size > MAX_HEADER_LINE_BYTES) {
        return null
      }
    }
  }

  private fun writeJsonResponse(output: BufferedOutputStream, statusCode: Int, body: String) {
    val reason = when (statusCode) {
      200 -> "OK"
      204 -> "No Content"
      400 -> "Bad Request"
      404 -> "Not Found"
      else -> "OK"
    }
    val bodyBytes = body.toByteArray(Charsets.UTF_8)
    val headers =
      "HTTP/1.1 $statusCode $reason\r\n" +
        "Content-Type: application/json; charset=utf-8\r\n" +
        "Access-Control-Allow-Origin: *\r\n" +
        "Access-Control-Allow-Methods: GET,POST,OPTIONS\r\n" +
        "Access-Control-Allow-Headers: Content-Type\r\n" +
        "Cache-Control: no-store\r\n" +
        "Content-Length: ${bodyBytes.size}\r\n" +
        "Connection: close\r\n\r\n"

    output.write(headers.toByteArray(Charsets.US_ASCII))
    if (bodyBytes.isNotEmpty()) {
      output.write(bodyBytes)
    }
    output.flush()
  }

  private fun buildStatusMap() =
    Arguments.createMap().apply {
      val ipAddress = getLocalIpv4Address()
      val hasHost = ipAddress.isNotBlank()
      putBoolean("running", isRunning.get())
      putInt("port", activePort)
      putString("host", ipAddress)
      putString("url", if (hasHost) "http://$ipAddress:$activePort" else "")
      putString(
        "message",
        if (hasHost) "" else "Receiver is running, but Android did not expose the Wi-Fi IP address."
      )
      putInt("pendingCount", receivedSnapshots.size)
    }

  private fun getLocalIpv4Address(): String {
    val wifiAddress = getWifiManagerIpv4Address()
    if (wifiAddress.isNotBlank()) {
      return wifiAddress
    }

    try {
      val interfaces = NetworkInterface.getNetworkInterfaces()
      for (networkInterface in interfaces) {
        if (!networkInterface.isUp || networkInterface.isLoopback) {
          continue
        }

        val addresses = networkInterface.inetAddresses
        for (address in addresses) {
          if (address is Inet4Address && !address.isLoopbackAddress && address.isSiteLocalAddress) {
            return address.hostAddress ?: ""
          }
        }
      }
    } catch (_: Exception) {
      return ""
    }

    return ""
  }

  private fun getWifiManagerIpv4Address(): String {
    try {
      val wifiManager =
        reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return ""
      val ipAddress = wifiManager.connectionInfo?.ipAddress ?: 0

      if (ipAddress == 0) {
        return ""
      }

      return listOf(
        ipAddress and 0xff,
        ipAddress shr 8 and 0xff,
        ipAddress shr 16 and 0xff,
        ipAddress shr 24 and 0xff
      ).joinToString(".")
    } catch (_: Exception) {
      return ""
    }
  }

  private fun stopServerInternal() {
    isRunning.set(false)

    try {
      serverSocket?.close()
    } catch (_: Exception) {
      // Already closed.
    }

    serverSocket = null
    serverThread = null
  }

  companion object {
    const val NAME = "LocalLeaderboardSync"
    const val DEFAULT_PORT = 8765
    private const val REQUEST_TIMEOUT_MS = 30000
    private const val MAX_BODY_BYTES = 10 * 1024 * 1024
    private const val MAX_HEADER_LINE_BYTES = 16 * 1024
  }
}
