const fs = require('fs');
const mysql = require('mysql2');

const {
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = 'Benfica1904',
  DB_NAME = 'SoundCircle',
} = process.env;

const connectionOptions = {
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  multipleStatements: false,
  enableKeepAlive: true,
};

const resolveSocketPath = () => {
  if (process.env.DB_SOCKET_PATH) {
    return process.env.DB_SOCKET_PATH;
  }

  const defaultSocketCandidates = [
    '/tmp/mysql.sock', // macOS / Linux default
    '/var/run/mysqld/mysqld.sock', // Debian/Ubuntu
    '/var/lib/mysql/mysql.sock', // RHEL/CentOS
  ];

  return defaultSocketCandidates.find((candidate) => fs.existsSync(candidate));
};

if ((!process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1') && !process.env.DB_SOCKET_PATH) {
  const socketPath = resolveSocketPath();
  if (socketPath) {
    connectionOptions.socketPath = socketPath;
    delete connectionOptions.host;
    delete connectionOptions.port;
    console.log(`A utilizar ligação por socket MySQL (${socketPath})`);
  }
}

const db = mysql.createPool(connectionOptions);

db.getConnection((err, conn) => {
  if (err) {
    console.error(
      'Erro ao ligar à base de dados:',
      err.code || err.message,
      '- verifique se o MySQL está a correr e se as credenciais/porta estão corretas.'
    );
    return;
  }
  console.log('Ligado à base de dados MySQL.');
  conn.release();
});

module.exports = db;
