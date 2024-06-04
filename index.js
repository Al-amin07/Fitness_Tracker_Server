const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000;
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());


const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Forbidden Access' })
  }
  const token = req.headers.authorization.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ message: 'Forbidden Access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Forbidden Access' })
    }
    req.user = decoded;
    // console.log('Yes Verifyed', decoded);
    next()
  })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pekpvn6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db('fitness').collection('users');
    const classCollection = client.db('fitness').collection('classs');
    const trainerCollection = client.db('fitness').collection('trainers');
    const appliedTrainerCollection = client.db('fitness').collection('appliedTrainers');

    // Verify Admin 

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      
      const query = {email};
      const result = await userCollection.findOne(query)
      
      if(result.role !== 'admin'){
       return  res.status(401).send({message:'Forbidden Access!'})
      }
      next()
    }

    // User Role

    app.get('/role/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      // console.log(email, query);
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    // User

    app.put('/user', async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await userCollection.findOne(query);
      // console.log(isExist);
      if (isExist) {
        if (user.status === 'requested') {
          const updatedDoc = {
            $set: {
              status: user?.status
            }
          }
          const result = await userCollection.updateOne(query, updatedDoc)
        }
        else if (!isExist.displayName && user.displayName) {
          const updatedDoc = {
            $set: {
              name: user?.displayName,
              image: user?.photoURL
            }
          }
          const result = await userCollection.updateOne(query, updatedDoc)
          res.send(result)
        }
        else {
          return res.send({ message: 'Can not' })
        }
      }
      else {
        const optiopns = { upsert: true }
        const updatedDoc = {
          $set: {
            ...user
          }
        }
        const result = await userCollection.updateOne(query, updatedDoc, optiopns);
        res.send(result)
      }
    })

    app.post('/user', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    // Get All Trainer

    app.get('/trainer', async (req, res) => {

      const result = await trainerCollection.find().toArray();
      res.send(result)

    })

    app.get('/trainer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await trainerCollection.findOne(query);
      res.send(result)
    })

    app.post('/trainers', async(req, res) => {
      const user = req.body;
      const result = await trainerCollection.insertOne(user);
      res.send(result)
    })
    
    app.delete('/trainer/:id', async (req, res) => {
      const id = req.params.id;
      const emailQuery = { email: req.query.email };

      // console.log('in delete',id, email);
      const updatedDoc = {
        $set: {
          role: 'member'
        }
      }
      const query = { _id: new ObjectId(id) };
      const updatedResult = await userCollection.updateOne(emailQuery, updatedDoc);
      const deletedResult = await trainerCollection.deleteOne(query);
      res.send(deletedResult)

    })

    // Applied Trainer

    app.get('/applied-trainers', verifyToken, verifyAdmin, async (req, res) => {
      const query = { status: 'pending'}
      const result = await appliedTrainerCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/applied-trainers', async (req, res) => {
      const user = req.body;
      const result = await appliedTrainerCollection.insertOne(user);
      res.send(result)
    })

    app.delete('/applied-trainers/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id)};
      const result = await appliedTrainerCollection.deleteOne(query);
      res.send(result);
    })

    // Classess

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.post('/classes', verifyToken, async (req, res) => {
      const details = req.body;
      const result = await classCollection.insertOne(details);
      res.send(result)
    })

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ token })
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hi Fitness Tracker')
})

app.listen(port, () => {
  console.log('Port running at : ', port);
})