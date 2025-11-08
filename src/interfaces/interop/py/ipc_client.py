"""
Cliente IPC para comunicación con el proceso Node.js mediante named pipes.
Compatible con Windows (named pipes) y Unix (Unix domain sockets).
"""

import os
import sys
import json
import socket
import tempfile
import platform
import base64
from typing import Any, Callable, Dict, Optional


class IPCMessage:
    """Mensaje IPC para comunicación entre procesos"""

    def __init__(
        self,
        msg_id: str,
        msg_type: str,
        method: Optional[str] = None,
        args: Optional[list] = None,
        result: Any = None,
        error: Optional[str] = None,
    ):
        self.id = msg_id
        self.type = msg_type
        self.method = method
        self.args = args or []
        self.result = result
        self.error = error

    def to_dict(self) -> dict:
        """Convierte el mensaje a diccionario"""
        return {
            "id": self.id,
            "type": self.type,
            "method": self.method,
            "args": self.args,
            "result": self.result,
            "error": self.error,
        }

    @staticmethod
    def from_dict(data: dict) -> "IPCMessage":
        """Crea un mensaje desde un diccionario"""
        return IPCMessage(
            msg_id=data.get("id", ""),
            msg_type=data.get("type", ""),
            method=data.get("method"),
            args=data.get("args"),
            result=data.get("result"),
            error=data.get("error"),
        )


class IPCServer:
    """
    Servidor IPC que escucha peticiones desde Node.js y las enruta a un handler.
    """

    def __init__(self, module_name: str, module_version: str, language: str = "python"):
        self.module_name = module_name
        self.module_version = module_version
        self.language = language
        self.handler: Optional[Callable] = None
        self.socket: Optional[socket.socket] = None
        self.pipe_path = self._get_pipe_path()

    def _get_pipe_path(self) -> str:
        """Genera la ruta del named pipe según el sistema operativo"""
        # Sanitizar el nombre del módulo (reemplazar / por -)
        safe_module_name = self.module_name.replace("/", "-").replace("\\", "-")
        pipe_name = f"{safe_module_name}-{self.module_version}-{self.language}"

        if platform.system() == "Windows":
            return f"\\\\.\\pipe\\{pipe_name}"
        else:
            base_path = os.path.join(tempfile.gettempdir(), "adc-platform")
            os.makedirs(base_path, exist_ok=True)
            pipe_path = os.path.join(base_path, pipe_name)
            
            # Eliminar pipe anterior si existe
            try:
                os.unlink(pipe_path)
            except OSError:
                pass
            
            return pipe_path

    def set_handler(self, handler: Callable[[str, list], Any]) -> None:
        """
        Establece el handler que procesará las llamadas a métodos.
        El handler debe ser una función que reciba (method_name, args) y retorne el resultado.
        """
        self.handler = handler

    def start(self) -> None:
        """Inicia el servidor IPC"""
        if not self.handler:
            raise RuntimeError("Debe establecer un handler antes de iniciar el servidor")

        try:
            # Crear socket Unix o named pipe
            if platform.system() == "Windows":
                # En Windows, usar named pipes nativos (requiere pywin32)
                # Por simplicidad, aquí usamos sockets TCP local
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                # TODO: Implementar named pipes nativos de Windows con pywin32
                print(f"[IPCServer] ADVERTENCIA: Named pipes de Windows no implementados, usando TCP", file=sys.stderr)
                self.socket.bind(("localhost", 0))
            else:
                self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.socket.bind(self.pipe_path)

            self.socket.listen(5)
            print(f"[IPCServer] Servidor iniciado en {self.pipe_path}", file=sys.stderr)

            # Bucle principal de escucha
            while True:
                try:
                    client_socket, _ = self.socket.accept()
                    self._handle_client(client_socket)
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"[IPCServer] Error aceptando cliente: {e}", file=sys.stderr)

        except Exception as e:
            print(f"[IPCServer] Error iniciando servidor: {e}", file=sys.stderr)
            raise
        finally:
            self.stop()

    def _handle_client(self, client_socket: socket.socket) -> None:
        """Maneja una conexión de cliente"""
        buffer = ""

        try:
            while True:
                data = client_socket.recv(4096)
                if not data:
                    break

                buffer += data.decode("utf-8")

                # Procesar mensajes completos (separados por newline)
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    if not line.strip():
                        continue

                    try:
                        message = IPCMessage.from_dict(json.loads(line))
                        response = self._process_message(message)
                        client_socket.sendall((json.dumps(response.to_dict()) + "\n").encode("utf-8"))
                    except Exception as e:
                        print(f"[IPCServer] Error procesando mensaje: {e}", file=sys.stderr)

        except Exception as e:
            print(f"[IPCServer] Error manejando cliente: {e}", file=sys.stderr)
        finally:
            client_socket.close()

    def _process_message(self, message: IPCMessage) -> IPCMessage:
        """Procesa un mensaje de request y genera una response"""
        if message.type != "request":
            return IPCMessage(msg_id=message.id, msg_type="error", error="Tipo de mensaje inválido")

        if not message.method:
            return IPCMessage(msg_id=message.id, msg_type="error", error="Método no especificado")

        try:
            # Deserializar buffers en los argumentos
            args = []
            for arg in message.args:
                if isinstance(arg, dict) and arg.get("__type") == "Buffer":
                    args.append(base64.b64decode(arg["data"]))
                else:
                    args.append(arg)
            
            # Llamar al handler con el método y argumentos
            result = self.handler(message.method, args)
            
            # Convertir bytes a base64 para serialización JSON
            if isinstance(result, bytes):
                result = {"__type": "Buffer", "data": base64.b64encode(result).decode('utf-8')}
            
            return IPCMessage(msg_id=message.id, msg_type="response", result=result)
        except Exception as e:
            return IPCMessage(msg_id=message.id, msg_type="error", error=str(e))

    def stop(self) -> None:
        """Detiene el servidor IPC"""
        if self.socket:
            self.socket.close()
            self.socket = None

        # Limpiar el archivo de socket en Unix
        if platform.system() != "Windows" and os.path.exists(self.pipe_path):
            try:
                os.unlink(self.pipe_path)
            except OSError:
                pass

        print(f"[IPCServer] Servidor detenido", file=sys.stderr)

