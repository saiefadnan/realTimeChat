const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./mongodb/user');
require('dotenv').config();
const bodyParser = require('body-parser');
const socketHandler = require('./socketHandler');
const routes = require('./routes/route');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server,{
    cors: {
        origin: "*",
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"],
        exposedHeaders: ['Content-Length', 'X-Kuma-Revision'],
        credentials: true
    },
    allowEIO3: true,
    pingTimeout: 60000
});
  
const corsOptions = {
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"],
    exposedHeaders: ['Content-Length', 'X-Kuma-Revision'],
    credentials: true,
    maxAge: 600,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

mongoose.connect(process.env.MONGODB_URL,{
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(()=>{
    console.log('MongoDB connected');
})
.catch(err => {
    console.error(err);
});

app.use(express.static(path.join(__dirname,'./public')));
app.get("/", (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api',routes);


socketHandler(io);

const PORT =4000;
server.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});
