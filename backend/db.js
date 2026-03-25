const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'logistix_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Configurações para evitar ECONNRESET
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Timeout settings (apenas connectTimeout é válido para pool)
    connectTimeout: 60000,
    // Reconexão automática
    maxIdle: 10,
    idleTimeout: 60000,
});

// Event handlers para monitorar conexões
pool.on('connection', (connection) => {
    console.log('✅ Nova conexão MySQL criada:', connection.threadId);
});

pool.on('acquire', (connection) => {
    console.log('🔄 Conexão adquirida:', connection.threadId);
});

pool.on('release', (connection) => {
    console.log('✅ Conexão liberada:', connection.threadId);
});

// Test connection with retry logic
const testConnection = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await pool.getConnection();
            console.log('✅ Banco de dados conectado com sucesso!');
            await connection.query('SELECT 1');
            connection.release();
            return true;
        } catch (err) {
            console.error(`❌ Tentativa ${i + 1}/${retries} de conexão falhou:`, err.message);
            if (i < retries - 1) {
                console.log('⏳ Tentando reconectar em 3 segundos...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.error('⚠️  Falha ao conectar ao banco de dados após', retries, 'tentativas');
                console.error('📝 Verifique se o MySQL está rodando e as credenciais em .env estão corretas');
                return false;
            }
        }
    }
    return false;
};

// Wrapper para queries com retry automático
async function queryWithRetry(sql, params, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await pool.query(sql, params);
        } catch (err) {
            if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.error(`⚠️  Erro de conexão (tentativa ${i + 1}/${retries}):`, err.message);
                if (i < retries - 1) {
                    console.log('🔄 Reconectando...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Tentar reconectar
                    await testConnection(2);
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
    }
}

async function withTransaction(callback) {
    let connection;
    let retries = 3;
    
    for (let i = 0; i < retries; i++) {
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (err) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackErr) {
                    console.error('❌ Erro ao fazer rollback:', rollbackErr.message);
                }
            }
            
            // Se for erro de conexão, tentar novamente
            if ((err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') && i < retries - 1) {
                console.error(`⚠️  Erro de conexão na transação (tentativa ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await testConnection(2);
                continue;
            }
            
            throw err;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

// Iniciar teste de conexão
testConnection().then(connected => {
    if (connected) {
        console.log('🎉 Sistema de banco de dados inicializado com sucesso!');
    } else {
        console.log('⚠️  Sistema iniciará mas operações de banco podem falhar');
    }
});

// Health check periódico (a cada 2 minutos)
setInterval(() => {
    pool.getConnection()
        .then(connection => {
            console.log('💓 Health check: Conexão OK');
            connection.release();
        })
        .catch(err => {
            console.error('💔 Health check: Conexão FALHOU -', err.message);
            console.log('🔄 Tentando reconectar...');
            testConnection(3);
        });
}, 120000);

module.exports = { pool, withTransaction, queryWithRetry, testConnection };
