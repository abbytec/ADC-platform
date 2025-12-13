/*
 * ADC Platform - Base Module Architecture
 * C++20 Implementation
 *
 * Dependencies:
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
            // Inicializar Logger después de cargar el nombre del módulo
            _logger = std::make_unique<::Core::KernelLogger>(_name);
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
            start();

            // Bloqueante (o podrías lanzarlo en un std::thread si prefieres non-blocking)
            _ipcServer->start();
        }

        // Lifecycle methods
        virtual void start() {}
        virtual void stop() {}

        // Getters de metadatos
        [[nodiscard]] std::string getName() const { return _name; }
        [[nodiscard]] std::string getVersion() const { return _version; }
        [[nodiscard]] json getConfig() const { return _config; }

    protected:
        // Método para que los hijos registren sus funciones
        using MethodHandler = std::function<json(const std::vector<json> &)>;

        void registerMethod(std::string_view name, MethodHandler handler)
        {
            _methodRegistry[std::string(name)] = std::move(handler);
        }

        // Helpers para logging
        void logInfo(std::string_view msg) const
        {
            _logger->info(msg);
        }

        void logOk(std::string_view msg) const
        {
            _logger->ok(msg);
        }

        void logWarn(std::string_view msg) const
        {
            _logger->warn(msg);
        }

        void logError(std::string_view msg) const
        {
            _logger->error(msg);
        }

    private:
        std::string _name;
        std::string _version;
        std::string _type;
        json _config;

        std::unique_ptr<IPCServer> _ipcServer;
        std::unique_ptr<::Core::KernelLogger> _logger;
        std::map<std::string, MethodHandler> _methodRegistry;

        void loadFromEnv()
        {
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

        // Dispatcher central
        json dispatchMethod(const std::string &name, const std::vector<json> &args)
        {
            auto it = _methodRegistry.find(name);
            if (it != _methodRegistry.end())
            {
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
        BaseUtility() = default;
    };

    // ==========================================
    // Base Provider
    // ==========================================
    class BaseProvider : public BaseModule
    {
    public:
        BaseProvider()
        {
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
        virtual void start() override
        {
            logInfo("Service starting...");
        }
    };

} // namespace Adc::Core
