/*
 * ADC Platform - Base Module Architecture
 * C++20 Implementation
 * * Dependencies:
 * - nlohmann/json
 * - fmt (optional, used std::format)
 */

#include <iostream>
#include <string>
#include <string_view>
#include <vector>
#include <map>
#include <functional>
#include <memory>
#include <cstdlib>
#include <stdexcept>
#include <nlohmann/json.hpp>

// Asumimos que tienes los headers anteriores
#include "kernel_logger.hpp"
#include "ipc_client.hpp"

using json = nlohmann::json;

namespace Adc::Core
{

    // ==========================================
    // Base Module
    // ==========================================
    class BaseModule
    {
    public:
        BaseModule()
        {
            loadFromEnv();
            // Inicializar Logger
            // _logger = KernelLogger::getInstance(_name); // Asumiendo singleton o factory
        }

        virtual ~BaseModule() = default;

        // Método principal para arrancar el módulo
        void run()
        {
            std::cout << "[BaseModule] Starting IPC Server for " << _name << "..." << std::endl;

            // Configuramos el servidor IPC con nuestros métodos registrados
            _ipcServer = std::make_unique<IPCServer>(_name, _version);

            _ipcServer->setHandler([this](const std::string &method, const std::vector<json> &args) -> json
                                   { return this->dispatchMethod(method, args); });

            // Hook para inicialización específica del hijo antes de bloquear
            onStart();

            // Bloqueante (o podrías lanzarlo en un std::thread si prefieres non-blocking)
            _ipcServer->start();
        }

        // Getters de metadatos
        [[nodiscard]] std::string getName() const { return _name; }
        [[nodiscard]] std::string getVersion() const { return _version; }
        [[nodiscard]] json getConfig() const { return _config; }

    protected:
        // El hijo debe implementar esto si necesita lógica de inicio
        virtual void onStart() {}

        // Método para que los hijos registren sus funciones (La forma C++ correcta)
        using MethodHandler = std::function<json(const std::vector<json> &)>;

        void registerMethod(std::string_view name, MethodHandler handler)
        {
            _methodRegistry[std::string(name)] = std::move(handler);
        }

        // Helpers para logging (wrappers al KernelLogger)
        void logInfo(std::string_view msg) const
        {
            std::cout << "[INFO] [" << _name << "] " << msg << std::endl; // Placeholder
        }

    private:
        std::string _name;
        std::string _version;
        std::string _type;
        json _config;

        std::unique_ptr<IPCServer> _ipcServer;
        std::map<std::string, MethodHandler> _methodRegistry;

        void loadFromEnv()
        {
            // Lectura segura de variables de entorno
            auto getEnv = [](const char *var, const char *def) -> std::string
            {
                const char *val = std::getenv(var);
                return val ? val : def;
            };

            _name = getEnv("ADC_MODULE_NAME", "unknown_module");
            _version = getEnv("ADC_MODULE_VERSION", "1.0.0");
            _type = getEnv("ADC_MODULE_TYPE", "service");

            std::string configStr = getEnv("ADC_MODULE_CONFIG", "{}");
            try
            {
                _config = json::parse(configStr);
            }
            catch (...)
            {
                std::cerr << "[BaseModule] Error parsing config, using empty object.\n";
                _config = json::object();
            }
        }

        // Dispatcher central de alta velocidad
        json dispatchMethod(const std::string &name, const std::vector<json> &args)
        {
            auto it = _methodRegistry.find(name);
            if (it != _methodRegistry.end())
            {
                // Invocamos la lambda registrada
                return it->second(args);
            }
            throw std::runtime_error("Method '" + name + "' not found in module " + _name);
        }
    };

    // ==========================================
    // Base Utility
    // ==========================================
    class BaseUtility : public BaseModule
    {
    protected:
        // En C++ no necesitamos "get_instance" porque 'this' ES la instancia.
        // Simplemente forzamos a registrar métodos en el constructor.
        BaseUtility()
        {
            // Lógica común de utilities si la hubiera
        }
    };

    // ==========================================
    // Base Provider
    // ==========================================
    class BaseProvider : public BaseModule
    {
    public:
        BaseProvider()
        {
            // Leer configuración específica de providers
            if (getConfig().contains("type"))
            {
                _providerType = getConfig()["type"];
            }
        }

        [[nodiscard]] std::string getProviderType() const { return _providerType; }

    private:
        std::string _providerType;
    };

    // ==========================================
    // Base Service
    // ==========================================
    class BaseService : public BaseModule
    {
    protected:
        // Los servicios suelen tener ciclos de vida más complejos
        virtual void onStart() override
        {
            // Ejemplo: iniciar hilos de fondo, conexiones a DB, etc.
            logInfo("Service starting background tasks...");
        }
    };

} // namespace Adc::Core

// ==========================================
// EJEMPLO DE USO (Así es como se escribe código de verdad)
// ==========================================

class ImageProcessor : public Adc::Core::BaseUtility
{
public:
    ImageProcessor()
    {
        // REGISTRO EXPLÍCITO: Limpio, seguro y sin magia negra.

        registerMethod("resize", [this](const std::vector<json> &args) -> json
                       {
            if (args.size() < 2) throw std::invalid_argument("Resize needs width and height");
            int w = args[0];
            int h = args[1];
            return this->resizeImage(w, h); });

        registerMethod("getStatus", [](const std::vector<json> &) -> json
                       { return {{"status", "idle"}, {"load", 0.0}}; });
    }

private:
    json resizeImage(int w, int h)
    {
        // Lógica real de C++ aquí
        logInfo("Resizing image to " + std::to_string(w) + "x" + std::to_string(h));
        return {{"success", true}, {"new_size", {w, h}}};
    }
};
/*
// Main boilerpolate simplificado
int main()
{
    try
    {
        ImageProcessor module;
        module.run(); // Bloquea y atiende peticiones IPC
    }
    catch (const std::exception &e)
    {
        std::cerr << "Fatal Crash: " << e.what() << std::endl;
        return 1;
    }
    return 0;
} */