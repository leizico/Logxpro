const { pool } = require('../../db');

// Get all profiles
const getProfiles = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM perfis ORDER BY nome');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching profiles:', error);
        res.status(500).json({ message: 'Error fetching profiles' });
    }
};

// Create a new profile
const createProfile = async (req, res) => {
    const { nome, descricao, permissoes } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO perfis (nome, descricao, permissoes) VALUES (?, ?, ?)',
            [nome, descricao, JSON.stringify(permissoes || [])]
        );
        res.status(201).json({ id: result.insertId, nome, descricao, permissoes });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ message: 'Error creating profile' });
    }
};

module.exports = { getProfiles, createProfile };
