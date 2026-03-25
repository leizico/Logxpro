const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../db');
const { loginSchema, registerSchema } = require('../../schemas');
const { JWT_SECRET } = require('../middleware/auth');

const login = async (req, res) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
    }
    const { id, password } = validation.data;

    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        if (rows.length > 0) {
            const u = rows[0];
            let passwordMatch = false;

            if (u.senha) {
                if (u.senha.startsWith('$2b$') || u.senha.startsWith('$2a$')) {
                    passwordMatch = await bcrypt.compare(password, u.senha);
                } else {
                    if (u.senha === password) {
                        passwordMatch = true;
                        const newHash = await bcrypt.hash(password, 10);
                        await pool.query('UPDATE usuarios SET senha = ? WHERE id = ?', [newHash, u.id]);
                    }
                }
            } else {
                if (password === '123456') {
                    passwordMatch = true;
                    const newHash = await bcrypt.hash('123456', 10);
                    await pool.query('UPDATE usuarios SET senha = ? WHERE id = ?', [newHash, u.id]);
                }
            }

            if (!passwordMatch) {
                return res.status(401).json({ error: 'Senha incorreta' });
            }

            const role = u.funcao === 'ADMIN' ? 'MANAGER' : 'DRIVER';
            
            // Generate JWT
            const token = jwt.sign(
                { id: u.id.toString(), role: role, name: u.nome },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ 
                token,
                user: {
                    id: u.id.toString(), 
                    name: u.nome, 
                    vehiclePlate: u.placa_veiculo, 
                    role 
                }
            });
        } else {
            res.status(401).json({ error: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const register = async (req, res) => {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
    }
    const { name, password, role, vehiclePlate } = validation.data;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const dbRole = role === 'MANAGER' ? 'ADMIN' : 'DRIVER';
        
        const [result] = await pool.query(
            'INSERT INTO usuarios (nome, placa_veiculo, funcao, senha) VALUES (?, ?, ?, ?)',
            [name, vehiclePlate || null, dbRole, hashedPassword]
        );

        const id = result.insertId.toString();
        
        const token = jwt.sign(
            { id: id, role: role, name: name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ 
            token,
            user: {
                id: id, 
                name: name, 
                vehiclePlate: vehiclePlate, 
                role 
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { login, register };
