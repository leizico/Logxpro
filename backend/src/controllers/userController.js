const bcrypt = require('bcrypt');
const { pool } = require('../../db');
const { driverSchema } = require('../../schemas');

const getManagers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.nome, u.placa_veiculo, u.funcao, u.perfil_id, p.nome as perfil_nome 
            FROM usuarios u 
            LEFT JOIN perfis p ON u.perfil_id = p.id 
            WHERE u.funcao = "ADMIN" OR p.nome IN ("Gestor", "Administrador")
        `);
        res.json(rows.map(r => ({
            id: r.id.toString(),
            name: r.nome,
            role: 'MANAGER',
            perfilId: r.perfil_id,
            perfilName: r.perfil_nome
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const getDrivers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.nome, u.placa_veiculo, u.funcao, u.perfil_id, p.nome as perfil_nome 
            FROM usuarios u 
            LEFT JOIN perfis p ON u.perfil_id = p.id 
            ORDER BY u.nome
        `);
        res.json(rows.map(r => ({
            id: r.id.toString(),
            name: r.nome,
            vehiclePlate: r.placa_veiculo,
            role: (r.funcao === 'ADMIN' || r.perfil_nome === 'Gestor' || r.perfil_nome === 'Administrador') ? 'MANAGER' : 'DRIVER',
            perfilId: r.perfil_id,
            perfilName: r.perfil_nome
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const createUser = async (req, res) => {
    // Basic validation (extend schema later for perfilId)
    const { name, vehiclePlate, password, role, perfilId } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password || '123456', 10);

        // Determine Legacy Role
        let dbRole = 'MOTORISTA';
        if (role === 'MANAGER') dbRole = 'ADMIN';

        // If perfilId is provided, check if it's admin-like
        if (perfilId) {
            const [p] = await pool.query('SELECT nome FROM perfis WHERE id = ?', [perfilId]);
            if (p.length > 0 && (p[0].nome === 'Gestor' || p[0].nome === 'Administrador')) {
                dbRole = 'ADMIN';
            }
        }

        const [result] = await pool.query(
            'INSERT INTO usuarios (nome, placa_veiculo, funcao, senha, perfil_id) VALUES (?, ?, ?, ?, ?)',
            [name, vehiclePlate, dbRole, hashedPassword, perfilId || null]
        );

        const id = result.insertId.toString();
        res.status(201).json({ id, name, vehiclePlate, role: dbRole === 'ADMIN' ? 'MANAGER' : 'DRIVER' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, vehiclePlate, perfilId, password } = req.body;
    try {
        let query = 'UPDATE usuarios SET nome = ?, placa_veiculo = ?';
        const params = [name, vehiclePlate];

        if (perfilId) {
            query += ', perfil_id = ?';
            params.push(perfilId);

            // Update legacy role too
            // You might want to fetch profile name to set legacy role correctly, but valid for now
            // For simplicity, we assume if updating profile, we might update legacy role based on known IDs or just leave it.
            // Best effort:
            const [p] = await pool.query('SELECT nome FROM perfis WHERE id = ?', [perfilId]);
            if (p.length > 0) {
                const legacyRole = (p[0].nome === 'Gestor' || p[0].nome === 'Administrador') ? 'ADMIN' : 'MOTORISTA';
                query += ', funcao = ?';
                params.push(legacyRole);
            }
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', senha = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);
        res.json({ message: 'User updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { getManagers, getDrivers, createUser, updateUser, deleteUser };
