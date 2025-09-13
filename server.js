require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Use uuid@8.3.2
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bot-deployer';

// GitHub repository URLs
const REPOSITORIES = {
  khan: 'https://github.com/JawadTechXD/KHAN-MD/tarball/main',
  jawad: 'https://github.com/JawadTechXD/JAWAD-MD/tarball/main'
};

// Connect to MongoDB
let db;
let dbClient;

async function connectToMongo() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('Connected to MongoDB');
    dbClient = client;
    db = client.db();
    
    // Create indexes
    await db.collection('deployments').createIndex({ username: 1 });
    await db.collection('deployments').createIndex({ token: 1 }, { unique: true });
    await db.collection('deployments').createIndex({ name: 1 }, { unique: true });
    
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

// Initialize connection
connectToMongo();

// Middleware to check MongoDB connection
app.use(async (req, res, next) => {
  if (!db) {
    const connected = await connectToMongo();
    if (!connected) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get deployment count for a user
app.get('/api/deployments/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const deployments = await db.collection('deployments').countDocuments({ 
      username: username.toLowerCase() 
    });
    res.json({ count: deployments });
  } catch (error) {
    console.error('Error getting deployments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get bots for a token
app.get('/api/bots', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const deployment = await db.collection('deployments').findOne({ token });
    if (!deployment) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const bots = await db.collection('deployments')
      .find({ username: deployment.username })
      .project({ _id: 0, name: 1, type: 1, createdAt: 1 })
      .toArray();

    res.json({ bots });
  } catch (error) {
    console.error('Error getting bots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a bot
app.delete('/api/bots/:appName', async (req, res) => {
  try {
    const { appName } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const deployment = await db.collection('deployments').findOne({ token });
    if (!deployment) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    if (deployment.name !== appName) {
      return res.status(403).json({ error: 'Not authorized to delete this app' });
    }

    // Delete from Heroku (if you have this functionality)
    // const HEROKU_API_KEY = getRandomHerokuKey();
    // const herokuHeaders = { 
    //   Authorization: `Bearer ${HEROKU_API_KEY}`, 
    //   Accept: 'application/vnd.heroku+json; version=3' 
    // };
    // await axios.delete(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders });

    // Delete from database
    await db.collection('deployments').deleteOne({ name: appName });

    res.json({ message: 'App deleted successfully' });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deploy a new bot
app.post('/deploy', async (req, res) => {
  const { username, session_id, appname, bot_type, config } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'GitHub username is required' });
  }

  if (!session_id) {
    return res.status(400).json({ error: 'SESSION_ID is required' });
  }

  // Check deployment limit
  try {
    const deployments = await db.collection('deployments').countDocuments({ 
      username: username.toLowerCase() 
    });
    
    // Check if user is a pro user
    let userLimit = 2;
    try {
      const proResponse = await axios.get('https://raw.githubusercontent.com/JawadTechXD/pro-users/main/pro.json');
      const proUsers = proResponse.data;
      const proUser = proUsers.find(user => user.username.toLowerCase() === username.toLowerCase());
      if (proUser) {
        userLimit = proUser.limit || 5;
      }
    } catch (error) {
      console.error('Error fetching pro users:', error);
    }

    if (deployments >= userLimit) {
      return res.status(400).json({ error: `You've reached the maximum deployment limit (${deployments}/${userLimit}). Please contact admin.` });
    }
  } catch (error) {
    console.error('Error checking deployment limit:', error);
  }

  const generatedAppName = appname?.trim() 
    ? appname.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    : `${bot_type}md-${uuidv4().slice(0, 6)}`;

  try {
    // In a real implementation, you would deploy to Heroku here
    // For now, we'll just simulate the deployment
    
    // Generate access token and save deployment to database
    const token = uuidv4();
    await db.collection('deployments').insertOne({
      username: username.toLowerCase(),
      name: generatedAppName,
      type: bot_type,
      token,
      createdAt: new Date(),
      session_id: session_id,
      config: config
    });

    res.json({ 
      message: 'Deployment started successfully! Bot will be ready in 2 minutes.',
      token,
      appName: generatedAppName
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ 
      error: 'Deployment failed', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', database: db ? 'Connected' : 'Disconnected' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (dbClient) {
    await dbClient.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
