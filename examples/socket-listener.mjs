import { io } from 'socket.io-client';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001';
const apiKey = process.env.API_KEY ?? '';
const sendPhone = process.env.SEND_PHONE ?? '';
const sendText = process.env.SEND_TEXT ?? '';

if (!apiKey) {
  console.error('Missing API_KEY. Example: API_KEY=otp_xxx_xxx node socket-listener.mjs');
  process.exit(1);
}

const socket = io(baseUrl, {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { apiKey },
  timeout: 10000,
});

socket.on('connect', () => {
  console.log(`[socket] connected: ${socket.id}`);

  if (sendPhone && sendText) {
    socket.emit(
      'whatsapp.message.send',
      { phoneNumber: sendPhone, text: sendText },
      (ack) => {
        console.log('[ack] whatsapp.message.send');
        console.log(JSON.stringify(ack, null, 2));
      }
    );
  }
});

socket.on('connect_error', (err) => {
  console.error('[socket] connect_error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[socket] disconnected:', reason);
});

socket.on('whatsapp.message.received', (payload) => {
  console.log('[event] whatsapp.message.received');
  console.log(JSON.stringify(payload, null, 2));
});

process.on('SIGINT', () => {
  console.log('\nShutting down listener...');
  socket.disconnect();
  process.exit(0);
});
