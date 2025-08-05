#include <td/telegram/td_json_client.h>
#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <cstring>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>

class TDLibJSONServer {
private:
    void* client;
    int server_fd;
    bool running;

public:
    TDLibJSONServer() : client(nullptr), server_fd(-1), running(false) {
        client = td_json_client_create();
    }

    ~TDLibJSONServer() {
        if (client) {
            td_json_client_destroy(client);
        }
        if (server_fd >= 0) {
            close(server_fd);
        }
    }

    bool startServer(int port = 8080) {
        struct sockaddr_in address;
        int opt = 1;

        // Create socket
        if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
            std::cerr << "Socket creation failed" << std::endl;
            return false;
        }

        // Set socket options
        if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
            std::cerr << "Setsockopt failed" << std::endl;
            return false;
        }

        address.sin_family = AF_INET;
        address.sin_addr.s_addr = INADDR_ANY;
        address.sin_port = htons(port);

        // Bind socket
        if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
            std::cerr << "Bind failed" << std::endl;
            return false;
        }

        // Listen for connections
        if (listen(server_fd, 3) < 0) {
            std::cerr << "Listen failed" << std::endl;
            return false;
        }

        std::cout << "TDLib JSON Server listening on port " << port << std::endl;
        running = true;
        return true;
    }

    void handleClient(int client_socket) {
        char buffer[4096] = {0};
        
        while (running) {
            int valread = read(client_socket, buffer, 4096);
            if (valread <= 0) break;

            // Send request to TDLib
            td_json_client_send(client, buffer);

            // Get response from TDLib
            const char* response = td_json_client_receive(client, 1.0);
            if (response) {
                send(client_socket, response, strlen(response), 0);
            }

            memset(buffer, 0, sizeof(buffer));
        }

        close(client_socket);
    }

    void run() {
        struct sockaddr_in address;
        int addrlen = sizeof(address);

        while (running) {
            int client_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen);
            if (client_socket < 0) {
                continue;
            }

            std::cout << "New client connected" << std::endl;
            std::thread client_thread(&TDLibJSONServer::handleClient, this, client_socket);
            client_thread.detach();
        }
    }

    void stop() {
        running = false;
    }
};

int main() {
    TDLibJSONServer server;
    
    if (!server.startServer()) {
        return 1;
    }

    server.run();
    return 0;
}