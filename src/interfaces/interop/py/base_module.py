"""
Clases base para módulos Python en ADC Platform.
Proporciona la estructura base para Utilities, Providers y Services.
"""

import os
import json
import sys
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from ipc_client import IPCServer
from kernel_logger import get_kernel_logger


class BaseModule(ABC):
    """Clase base para todos los módulos Python"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._name: Optional[str] = None
        self._version: Optional[str] = None
        self._module_type: Optional[str] = None
        self.logger = None

        # Leer configuración desde variables de entorno
        self._load_from_env()
        
        # Crear el logger del kernel
        self.logger = get_kernel_logger(self._name)

    def _load_from_env(self) -> None:
        """Carga la configuración desde variables de entorno"""
        self._name = os.environ.get("ADC_MODULE_NAME", "unknown")
        self._version = os.environ.get("ADC_MODULE_VERSION", "1.0.0")
        self._module_type = os.environ.get("ADC_MODULE_TYPE", "unknown")

        # Parsear configuración adicional
        config_str = os.environ.get("ADC_MODULE_CONFIG", "{}")
        try:
            env_config = json.loads(config_str)
            self.config.update(env_config)
        except json.JSONDecodeError:
            print(f"[BaseModule] Error parseando ADC_MODULE_CONFIG", file=sys.stderr)

    @property
    def name(self) -> str:
        """Nombre del módulo"""
        return self._name or "unknown"

    @abstractmethod
    def get_handler_methods(self) -> Dict[str, callable]:
        """
        Retorna un diccionario con los métodos que pueden ser llamados via IPC.
        Las claves son los nombres de los métodos y los valores son las funciones.
        """
        pass

    def start_ipc_server(self) -> None:
        """Inicia el servidor IPC para este módulo"""
        ipc_server = IPCServer(self._name, self._version, "python")

        # Configurar el handler
        methods = self.get_handler_methods()

        def handler(method_name: str, args: list) -> Any:
            if method_name not in methods:
                raise AttributeError(f"Método '{method_name}' no encontrado en {self.name}")

            method = methods[method_name]
            return method(*args)

        ipc_server.set_handler(handler)

        # Iniciar el servidor (bloqueante)
        self.logger.info(f"Iniciando servidor IPC...")
        ipc_server.start()

    def stop(self) -> None:
        """Detiene el módulo"""
        self.logger.info(f"Deteniendo módulo...")


class BaseUtility(BaseModule):
    """Clase base para Utilities Python"""

    @abstractmethod
    def get_instance(self) -> Any:
        """
        Retorna la instancia que implementa la interfaz del utility.
        """
        pass

    def get_handler_methods(self) -> Dict[str, callable]:
        """Obtiene los métodos públicos de la instancia"""
        instance = self.get_instance()
        methods = {}

        for attr_name in dir(instance):
            if not attr_name.startswith("_"):
                attr = getattr(instance, attr_name)
                if callable(attr):
                    methods[attr_name] = attr

        return methods


class BaseProvider(BaseModule):
    """Clase base para Providers Python"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.provider_type: Optional[str] = config.get("type") if config else None

    @abstractmethod
    def get_instance(self) -> Any:
        """
        Retorna la instancia que implementa la interfaz del provider.
        """
        pass

    def get_handler_methods(self) -> Dict[str, callable]:
        """Obtiene los métodos públicos de la instancia"""
        instance = self.get_instance()
        methods = {}

        for attr_name in dir(instance):
            if not attr_name.startswith("_"):
                attr = getattr(instance, attr_name)
                if callable(attr):
                    methods[attr_name] = attr

        return methods


class BaseService(BaseModule):
    """Clase base para Services Python"""

    @abstractmethod
    def get_instance(self) -> Any:
        """
        Retorna la instancia que implementa la interfaz del service.
        """
        pass

    @abstractmethod
    async def start(self) -> None:
        """Inicia el servicio"""
        pass

    def get_handler_methods(self) -> Dict[str, callable]:
        """Obtiene los métodos públicos de la instancia"""
        instance = self.get_instance()
        methods = {}

        for attr_name in dir(instance):
            if not attr_name.startswith("_"):
                attr = getattr(instance, attr_name)
                if callable(attr):
                    methods[attr_name] = attr

        return methods

