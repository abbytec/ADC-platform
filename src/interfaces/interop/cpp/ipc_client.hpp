/*
 * IPC Server - C++ Edition
 * High-performance, Type-safe, Native Implementation.
 * * Dependencies: nlohmann/json
 * Compile:
 * Linux: g++ -std=c++17 -pthread main.cpp -o ipc_server
 * Windows: cl /std:c++17 /EHsc main.cpp
 */

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <mutex>
#include <atomic>
#include <filesystem>
#include <nlohmann/json.hpp>

// Platform specific includes
#ifdef _WIN32
#include <windows.h>
#else
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#endif

using json = nlohmann::json;

// ==========================================
// Base64 Helper (Compact & Fast)
// ==========================================
namespace Base64
{
    static const std::string base64_chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";

    std::string encode(const std::vector<uint8_t> &buf)
    {
        std::string ret;
        int i = 0;
        int j = 0;
        unsigned char char_array_3[3];
        unsigned char char_array_4[4];

        for (auto byte : buf)
        {
            char_array_3[i++] = byte;
            if (i == 3)
            {
                char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
                char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
                char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
                char_array_4[3] = char_array_3[2] & 0x3f;
                for (i = 0; (i < 4); i++)
                    ret += base64_chars[char_array_4[i]];
                i = 0;
            }
        }
        if (i)
        {
            for (j = i; j < 3; j++)
                char_array_3[j] = '\0';
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
            for (j = 0; (j < i + 1); j++)
                ret += base64_chars[char_array_4[j]];
            while ((i++ < 3))
                ret += '=';
        }
        return ret;
    }

    std::vector<uint8_t> decode(std::string_view encoded_string)
    {
        int in_len = encoded_string.size();
        int i = 0, j = 0, in_ = 0;
        unsigned char char_array_4[4], char_array_3[3];
        std::vector<uint8_t> ret;

        while (in_len-- && (encoded_string[in_] != '=') &&
               (isalnum(encoded_string[in_]) || (encoded_string[in_] == '+') || (encoded_string[in_] == '/')))
        {
            char_array_4[i++] = encoded_string[in_];
            in_++;
            if (i == 4)
            {
                for (i = 0; i < 4; i++)
                    char_array_4[i] = base64_chars.find(char_array_4[i]);
                char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
                char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
                char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
                for (i = 0; (i < 3); i++)
                    ret.push_back(char_array_3[i]);
                i = 0;
            }
        }
        if (i)
        {
            for (j = i; j < 4; j++)
                char_array_4[j] = 0;
            for (j = 0; j < 4; j++)
                char_array_4[j] = base64_chars.find(char_array_4[j]);
            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];
            for (j = 0; (j < i - 1); j++)
                ret.push_back(char_array_3[j]);
        }
        return ret;
    }
}

// ==========================================
// DTOs (Data Transfer Objects)
// ==========================================
struct IPCMessage
{
    std::string id;
    std::string type;
    std::string method; // Opcional
    std::vector<json> args;
    json result = nullptr;
    std::string error;

    // Macro mágica de nlohmann para serialización automática
    NLOHMANN_DEFINE_TYPE_INTRUSIVE(IPCMessage, id, type, method, args, result, error);
};

// ==========================================
// IPC Server Class
// ==========================================
class IPCServer
{
public:
    using HandlerFunc = std::function<json(const std::string &method, const std::vector<json> &args)>;

    IPCServer(std::string module_name, std::string module_version)
        : _module_name(std::move(module_name)), _module_version(std::move(module_version))
    {
        _pipe_path = generatePipePath();
    }

    ~IPCServer()
    {
        stop();
    }

    void setHandler(HandlerFunc handler)
    {
        _handler = std::move(handler);
    }

    void start()
    {
        if (!_handler)
            throw std::runtime_error("Handler not set!");

        std::cout << "[IPC] Starting server at " << _pipe_path << std::endl;

#ifdef _WIN32
        runWindowsServer();
#else
        runUnixServer();
#endif
    }

    void stop()
    {
        _running = false;
        // La limpieza real depende del OS, aquí simplificamos flags
#ifndef _WIN32
        if (!_pipe_path.empty())
            unlink(_pipe_path.c_str());
#endif
    }

private:
    std::string _module_name;
    std::string _module_version;
    std::string _pipe_path;
    HandlerFunc _handler;
    std::atomic<bool> _running{true};

    // --- Path Generation ---
    std::string generatePipePath()
    {
        std::string safe_name = _module_name;
        // Reemplazo simple, std::regex es overkill a veces
        for (auto &c : safe_name)
            if (c == '/' || c == '\\')
                c = '-';

        std::string pipe_name = safe_name + "-" + _module_version + "-cpp";

#ifdef _WIN32
        return "\\\\.\\pipe\\" + pipe_name;
#else
        return "/tmp/adc-platform/" + pipe_name;
#endif
    }

    // --- Message Processing ---
    std::string processRequest(const std::string &raw_json)
    {
        try
        {
            auto j = json::parse(raw_json);
            IPCMessage msg = j.get<IPCMessage>();

            if (msg.type != "request")
            {
                msg.type = "error";
                msg.error = "Invalid message type";
                return json(msg).dump();
            }

            // Procesar argumentos (Buffer decoding)
            std::vector<json> processed_args;
            for (const auto &arg : msg.args)
            {
                if (arg.is_object() && arg.contains("__type") && arg["__type"] == "Buffer")
                {
                    // Decodificar Base64 a vector<uint8_t> pero pasarlo como json array o custom obj
                    // Aquí simplificamos y pasamos el objeto raw, el handler decide
                    processed_args.push_back(arg);
                }
                else
                {
                    processed_args.push_back(arg);
                }
            }

            // Ejecutar Handler
            try
            {
                json res = _handler(msg.method, processed_args);

                // Si el resultado es binario (vector<uint8_t>), empaquetarlo como Buffer de Node
                // Nota: nlohmann detecta vector<uint8_t> como array de números.
                // Si quieres formato Node Buffer:
                if (res.is_binary() || (res.is_array() && !res.empty() && res[0].is_number_unsigned()))
                {
                    // Lógica custom si es necesario convertir a Base64 de vuelta
                    // Aquí asumimos retorno JSON estándar
                }

                msg.type = "response";
                msg.result = res;
            }
            catch (const std::exception &e)
            {
                msg.type = "error";
                msg.error = e.what();
            }

            return json(msg).dump();
        }
        catch (const std::exception &e)
        {
            // JSON malformado
            json err_msg;
            err_msg["type"] = "error";
            err_msg["error"] = std::string("JSON Parse Error: ") + e.what();
            return err_msg.dump();
        }
    }

    // --- Windows Implementation (Native Named Pipes) ---
#ifdef _WIN32
    void runWindowsServer()
    {
        while (_running)
        {
            HANDLE hPipe = CreateNamedPipeA(
                _pipe_path.c_str(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
                PIPE_UNLIMITED_INSTANCES,
                4096, 4096, 0, NULL);

            if (hPipe == INVALID_HANDLE_VALUE)
            {
                std::cerr << "[IPC] Failed to create pipe. Error: " << GetLastError() << std::endl;
                return;
            }

            if (ConnectNamedPipe(hPipe, NULL) || GetLastError() == ERROR_PIPE_CONNECTED)
            {
                // Manejar cliente en este hilo (simple) o spawnear thread para concurrencia
                char buffer[4096];
                DWORD bytesRead;

                while (ReadFile(hPipe, buffer, sizeof(buffer) - 1, &bytesRead, NULL))
                {
                    buffer[bytesRead] = '\0';
                    std::string request(buffer);

                    // Manejar múltiples líneas si es necesario
                    std::string response = processRequest(request) + "\n";

                    DWORD bytesWritten;
                    WriteFile(hPipe, response.c_str(), response.size(), &bytesWritten, NULL);
                }
            }
            CloseHandle(hPipe);
        }
    }
#else
    // --- Unix Implementation (Domain Sockets) ---
    void runUnixServer()
    {
        // Asegurar directorio
        std::filesystem::path p(_pipe_path);
        std::filesystem::create_directories(p.parent_path());
        unlink(_pipe_path.c_str()); // Limpiar previo

        int server_fd, client_fd;
        struct sockaddr_un address;

        if ((server_fd = socket(AF_UNIX, SOCK_STREAM, 0)) == 0)
        {
            perror("[IPC] Socket failed");
            exit(EXIT_FAILURE);
        }

        memset(&address, 0, sizeof(address));
        address.sun_family = AF_UNIX;
        strncpy(address.sun_path, _pipe_path.c_str(), sizeof(address.sun_path) - 1);

        if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0)
        {
            perror("[IPC] Bind failed");
            exit(EXIT_FAILURE);
        }

        if (listen(server_fd, 5) < 0)
        {
            perror("[IPC] Listen failed");
            exit(EXIT_FAILURE);
        }

        // Buffer reutilizable
        std::vector<char> buffer(4096);

        while (_running)
        {
            if ((client_fd = accept(server_fd, NULL, NULL)) < 0)
            {
                continue;
            }

            // Simple handler loop
            ssize_t valread;
            std::string accumulator;

            while ((valread = read(client_fd, buffer.data(), buffer.size())) > 0)
            {
                accumulator.append(buffer.data(), valread);

                size_t pos;
                while ((pos = accumulator.find('\n')) != std::string::npos)
                {
                    std::string line = accumulator.substr(0, pos);
                    accumulator.erase(0, pos + 1);

                    if (line.empty())
                        continue;

                    std::string resp = processRequest(line) + "\n";
                    send(client_fd, resp.c_str(), resp.length(), 0);
                }
            }
            close(client_fd);
        }
        close(server_fd);
    }
#endif
};
/*
// ==========================================
// Usage Example
// ==========================================
int main()
{
    try
    {
        IPCServer server("SensorModule", "1.0.0");

        // Definimos el handler usando lambdas de C++ (Mucho más elegante)
        server.setHandler([](const std::string &method, const std::vector<json> &args) -> json
                          {
            if (method == "ping") {
                return "pong";
            }
            if (method == "processImage") {
                // Ejemplo: recibir buffer
                if (!args.empty() && args[0].contains("data")) {
                     std::string b64 = args[0]["data"];
                     auto raw_data = Base64::decode(b64);
                     std::cout << "Received " << raw_data.size() << " bytes of image data." << std::endl;
                     return {{"status", "processed"}, {"bytes", raw_data.size()}};
                }
            }
            throw std::runtime_error("Method not found"); });

        server.start();
    }
    catch (const std::exception &e)
    {
        std::cerr << "Fatal error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
} */