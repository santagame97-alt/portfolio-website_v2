// Тесты для WebSocketServer
import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import WebSocketServer from './WebSocketServer.js';

describe('WebSocketServer', () => {
  describe('Инициализация', () => {
    it('должен успешно создать WebSocket сервер', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      assert.ok(wsServer);
      assert.ok(wsServer.wss);
      assert.ok(wsServer.clients instanceof Map);
      assert.strictEqual(wsServer.heartbeatInterval, 30000);
      
      wsServer.close();
      httpServer.close();
    });
  });

  describe('Аутентификация', () => {
    it('должен извлечь токен из query параметров', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockReq = {
        url: '/ws?token=test-token-123',
        headers: { host: 'localhost:3000' }
      };
      
      const token = wsServer.extractToken(mockReq);
      assert.strictEqual(token, 'test-token-123');
      
      wsServer.close();
      httpServer.close();
    });

    it('должен извлечь токен из заголовка Authorization', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockReq = {
        url: '/ws',
        headers: {
          host: 'localhost:3000',
          authorization: 'Bearer test-token-456'
        }
      };
      
      const token = wsServer.extractToken(mockReq);
      assert.strictEqual(token, 'test-token-456');
      
      wsServer.close();
      httpServer.close();
    });

    it('должен вернуть null если токен не предоставлен', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockReq = {
        url: '/ws',
        headers: { host: 'localhost:3000' }
      };
      
      const token = wsServer.extractToken(mockReq);
      assert.strictEqual(token, null);
      
      wsServer.close();
      httpServer.close();
    });
  });

  describe('Управление клиентами', () => {
    it('должен добавить клиента в хранилище', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockWs = { userId: 1 };
      wsServer.addClient(1, mockWs);
      
      assert.ok(wsServer.clients.has(1));
      assert.strictEqual(wsServer.clients.get(1).size, 1);
      
      wsServer.close();
      httpServer.close();
    });

    it('должен удалить клиента из хранилища', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockWs = { userId: 1 };
      wsServer.addClient(1, mockWs);
      wsServer.removeClient(1, mockWs);
      
      assert.strictEqual(wsServer.clients.has(1), false);
      
      wsServer.close();
      httpServer.close();
    });

    it('должен поддерживать несколько соединений для одного пользователя', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const mockWs1 = { userId: 1, id: 'ws1' };
      const mockWs2 = { userId: 1, id: 'ws2' };
      
      wsServer.addClient(1, mockWs1);
      wsServer.addClient(1, mockWs2);
      
      assert.strictEqual(wsServer.clients.get(1).size, 2);
      
      wsServer.close();
      httpServer.close();
    });
  });

  describe('Отправка сообщений', () => {
    it('должен отправить сообщение конкретному пользователю', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      let receivedMessage = null;
      const mockWs = {
        userId: 1,
        readyState: 1, // WebSocket.OPEN
        send: (data) => {
          receivedMessage = JSON.parse(data);
        }
      };
      
      wsServer.addClient(1, mockWs);
      wsServer.sendToUser(1, { type: 'test', payload: { message: 'Hello' } });
      
      assert.ok(receivedMessage);
      assert.strictEqual(receivedMessage.type, 'test');
      assert.strictEqual(receivedMessage.payload.message, 'Hello');
      
      wsServer.close();
      httpServer.close();
    });

    it('должен отправить сообщение всем админам', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      const receivedMessages = [];
      
      const mockAdminWs = {
        userId: 1,
        isAdmin: true,
        readyState: 1,
        send: (data) => {
          receivedMessages.push(JSON.parse(data));
        }
      };
      
      const mockUserWs = {
        userId: 2,
        isAdmin: false,
        readyState: 1,
        send: (data) => {
          receivedMessages.push(JSON.parse(data));
        }
      };
      
      wsServer.addClient(1, mockAdminWs);
      wsServer.addClient(2, mockUserWs);
      
      wsServer.sendToAdmins({ type: 'admin_message', payload: { text: 'Admin only' } });
      
      // Только админ должен получить сообщение
      assert.strictEqual(receivedMessages.length, 1);
      assert.strictEqual(receivedMessages[0].type, 'admin_message');
      
      wsServer.close();
      httpServer.close();
    });

    it('не должен отправлять сообщение если сокет не открыт', async () => {
      const httpServer = http.createServer();
      const wsServer = new WebSocketServer(httpServer);
      
      let sendCalled = false;
      const mockWs = {
        userId: 1,
        readyState: 0, // WebSocket.CONNECTING
        send: () => {
          sendCalled = true;
        }
      };
      
      wsServer.addClient(1, mockWs);
      wsServer.sendToUser(1, { type: 'test' });
      
      assert.strictEqual(sendCalled, false);
      
      wsServer.close();
      httpServer.close();
    });
  });
});

  describe('Обработка типов WebSocket сообщений', () => {
    describe('new_message', () => {
      it('должен обработать новое сообщение от пользователя', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        const payload = {
          chatId: 1,
          content: 'Тестовое сообщение'
        };
        
        // Мокируем MessageService
        wsServer.messageService.sendMessage = async (chatId, userId, content) => {
          assert.strictEqual(chatId, 1);
          assert.strictEqual(userId, 2);
          assert.strictEqual(content, 'Тестовое сообщение');
          return {
            id: 1,
            chatId: 1,
            senderId: userId,
            content,
            isRead: false,
            createdAt: new Date()
          };
        };
        
        wsServer.messageService.getOrCreateChat = async (chatId) => {
          return { id: chatId, userId: 2 };
        };
        
        await wsServer.handleNewMessage(mockWs, payload);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен отклонить сообщение без chatId', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let errorSent = false;
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'error') {
            errorSent = true;
          }
        };
        
        const payload = {
          content: 'Сообщение без chatId'
        };
        
        await wsServer.handleNewMessage(mockWs, payload);
        
        assert.strictEqual(errorSent, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен отклонить пустое сообщение', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let errorSent = false;
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'error') {
            errorSent = true;
          }
        };
        
        const payload = {
          chatId: 1,
          content: ''
        };
        
        await wsServer.handleNewMessage(mockWs, payload);
        
        assert.strictEqual(errorSent, true);
        
        wsServer.close();
        httpServer.close();
      });
    });

    describe('message_read', () => {
      it('должен пометить сообщения как прочитанные для админа', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let markedAsRead = false;
        const mockWs = {
          userId: 1,
          isAdmin: true,
          readyState: 1
        };
        
        wsServer.messageService.markMessagesAsRead = async (chatId, userId) => {
          assert.strictEqual(chatId, 1);
          assert.strictEqual(userId, 1);
          markedAsRead = true;
        };
        
        wsServer.sendToSocket = () => {}; // Заглушка
        
        const payload = { chatId: 1 };
        
        await wsServer.handleMessageRead(mockWs, payload);
        
        assert.strictEqual(markedAsRead, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен отклонить запрос от не-админа', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let errorSent = false;
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'error') {
            errorSent = true;
            assert.ok(message.payload.message.includes('прав'));
          }
        };
        
        const payload = { chatId: 1 };
        
        await wsServer.handleMessageRead(mockWs, payload);
        
        assert.strictEqual(errorSent, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен отклонить запрос без chatId', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let errorSent = false;
        const mockWs = {
          userId: 1,
          isAdmin: true,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'error') {
            errorSent = true;
          }
        };
        
        const payload = {};
        
        await wsServer.handleMessageRead(mockWs, payload);
        
        assert.strictEqual(errorSent, true);
        
        wsServer.close();
        httpServer.close();
      });
    });

    describe('typing', () => {
      it('должен отправить индикатор набора текста от пользователя админу', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let typingNotificationSent = false;
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        wsServer.messageService.getOrCreateChat = async (chatId) => {
          return { id: chatId, userId: 2 };
        };
        
        wsServer.sendToAdmins = (message) => {
          assert.strictEqual(message.type, 'typing');
          assert.strictEqual(message.payload.chatId, 1);
          assert.strictEqual(message.payload.isTyping, true);
          assert.strictEqual(message.payload.userId, 2);
          typingNotificationSent = true;
        };
        
        const payload = {
          chatId: 1,
          isTyping: true
        };
        
        await wsServer.handleTyping(mockWs, payload);
        
        assert.strictEqual(typingNotificationSent, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен отправить индикатор набора текста от админа пользователю', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let typingNotificationSent = false;
        const mockWs = {
          userId: 1,
          isAdmin: true,
          readyState: 1
        };
        
        wsServer.messageService.getOrCreateChat = async (chatId) => {
          return { id: chatId, userId: 2 };
        };
        
        wsServer.sendToUser = (userId, message) => {
          assert.strictEqual(userId, 2);
          assert.strictEqual(message.type, 'typing');
          assert.strictEqual(message.payload.chatId, 1);
          assert.strictEqual(message.payload.isTyping, false);
          assert.strictEqual(message.payload.userId, 1);
          typingNotificationSent = true;
        };
        
        const payload = {
          chatId: 1,
          isTyping: false
        };
        
        await wsServer.handleTyping(mockWs, payload);
        
        assert.strictEqual(typingNotificationSent, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен обработать отсутствие chatId', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        const mockWs = {
          userId: 2,
          isAdmin: false,
          readyState: 1
        };
        
        const payload = {
          isTyping: true
        };
        
        // Не должно выбросить ошибку, просто логируется
        await wsServer.handleTyping(mockWs, payload);
        
        wsServer.close();
        httpServer.close();
      });
    });

    describe('user_banned', () => {
      it('должен уведомить пользователя о бане и закрыть соединение', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let notificationSent = false;
        let connectionClosed = false;
        
        const mockWs = {
          userId: 2,
          readyState: 1,
          send: (data) => {
            const message = JSON.parse(data);
            if (message.type === 'user_banned') {
              notificationSent = true;
              assert.ok(message.payload.message.includes('заблокирован'));
            }
          },
          close: (code, reason) => {
            connectionClosed = true;
            assert.strictEqual(code, 1008);
            assert.ok(reason.includes('заблокирован'));
          }
        };
        
        wsServer.addClient(2, mockWs);
        wsServer.notifyUserBanned(2);
        
        assert.strictEqual(notificationSent, true);
        assert.strictEqual(connectionClosed, true);
        assert.strictEqual(wsServer.clients.has(2), false);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен закрыть все соединения забаненного пользователя', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let closedConnections = 0;
        
        const mockWs1 = {
          userId: 2,
          readyState: 1,
          send: () => {},
          close: () => { closedConnections++; }
        };
        
        const mockWs2 = {
          userId: 2,
          readyState: 1,
          send: () => {},
          close: () => { closedConnections++; }
        };
        
        wsServer.addClient(2, mockWs1);
        wsServer.addClient(2, mockWs2);
        
        wsServer.notifyUserBanned(2);
        
        assert.strictEqual(closedConnections, 2);
        assert.strictEqual(wsServer.clients.has(2), false);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен корректно обработать бан несуществующего пользователя', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        // Не должно выбросить ошибку
        wsServer.notifyUserBanned(999);
        
        wsServer.close();
        httpServer.close();
      });
    });

    describe('handleMessage - маршрутизация типов', () => {
      it('должен правильно маршрутизировать new_message', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let handlerCalled = false;
        wsServer.handleNewMessage = async () => {
          handlerCalled = true;
        };
        
        const mockWs = { userId: 1 };
        const data = Buffer.from(JSON.stringify({
          type: 'new_message',
          payload: { chatId: 1, content: 'test' }
        }));
        
        await wsServer.handleMessage(mockWs, data);
        
        assert.strictEqual(handlerCalled, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен правильно маршрутизировать message_read', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let handlerCalled = false;
        wsServer.handleMessageRead = async () => {
          handlerCalled = true;
        };
        
        const mockWs = { userId: 1 };
        const data = Buffer.from(JSON.stringify({
          type: 'message_read',
          payload: { chatId: 1 }
        }));
        
        await wsServer.handleMessage(mockWs, data);
        
        assert.strictEqual(handlerCalled, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен правильно маршрутизировать typing', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let handlerCalled = false;
        wsServer.handleTyping = async () => {
          handlerCalled = true;
        };
        
        const mockWs = { userId: 1 };
        const data = Buffer.from(JSON.stringify({
          type: 'typing',
          payload: { chatId: 1, isTyping: true }
        }));
        
        await wsServer.handleMessage(mockWs, data);
        
        assert.strictEqual(handlerCalled, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен обработать ping сообщение', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let pongSent = false;
        const mockWs = {
          userId: 1,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'pong') {
            pongSent = true;
          }
        };
        
        const data = Buffer.from(JSON.stringify({ type: 'ping' }));
        
        await wsServer.handleMessage(mockWs, data);
        
        assert.strictEqual(pongSent, true);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен обработать неизвестный тип сообщения', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        const mockWs = { userId: 1 };
        const data = Buffer.from(JSON.stringify({
          type: 'unknown_type',
          payload: {}
        }));
        
        // Не должно выбросить ошибку, просто логируется предупреждение
        await wsServer.handleMessage(mockWs, data);
        
        wsServer.close();
        httpServer.close();
      });

      it('должен обработать невалидный JSON', async () => {
        const httpServer = http.createServer();
        const wsServer = new WebSocketServer(httpServer);
        
        let errorSent = false;
        const mockWs = {
          userId: 1,
          readyState: 1
        };
        
        wsServer.sendToSocket = (ws, message) => {
          if (message.type === 'error') {
            errorSent = true;
          }
        };
        
        const data = Buffer.from('invalid json{');
        
        await wsServer.handleMessage(mockWs, data);
        
        assert.strictEqual(errorSent, true);
        
        wsServer.close();
        httpServer.close();
      });
    });
  });
