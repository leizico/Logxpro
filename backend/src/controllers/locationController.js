const updateLocation = async (req, res) => {
    const { userId, lat, lng } = req.body;
    console.log(`[Location] User ${userId}: ${lat}, ${lng} `);
    // In a real app, update a 'driver_locations' table or Redis
    res.json({ status: 'ok' });
};

module.exports = { updateLocation };
