const { pool, queryWithRetry } = require('../../db');

const getNotifications = async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
        // Security check: Ensure users can only see their own notifications
        if (req.user && req.user.role !== 'MANAGER' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [rows] = await queryWithRetry(
            'SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY horario DESC', 
            [userId]
        );
        
        res.json(rows.map(r => ({
            id: r.id.toString(),
            userId: r.usuario_id.toString(),
            title: r.titulo,
            message: r.mensagem,
            timestamp: r.horario,
            read: r.lida
        })));
    } catch (err) {
        console.error('❌ Erro ao buscar notificações:', err.message);
        
        // Retornar erro mais específico
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
            return res.status(503).json({ 
                error: 'Conexão com banco de dados perdida. Tente novamente.',
                code: 'DB_CONNECTION_LOST'
            });
        }
        
        res.status(500).json({ 
            error: 'Erro ao buscar notificações',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

const createNotification = async (req, res) => {
    const { userId, title, message, timestamp } = req.body;

    if (!userId || !title || !message) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    try {
        const [result] = await queryWithRetry(
            'INSERT INTO notificacoes (usuario_id, titulo, mensagem, horario, lida) VALUES (?, ?, ?, ?, ?)',
            [userId, title, message, timestamp ? new Date(timestamp) : new Date(), false]
        );
        
        res.status(201).json({ 
            message: 'Notificação criada com sucesso', 
            id: result.insertId.toString() 
        });
    } catch (err) {
        console.error('❌ Erro ao criar notificação:', err.message);
        
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
            return res.status(503).json({ 
                error: 'Conexão com banco de dados perdida. Tente novamente.',
                code: 'DB_CONNECTION_LOST'
            });
        }
        
        res.status(500).json({ 
            error: 'Erro ao criar notificação',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

module.exports = { getNotifications, createNotification };
