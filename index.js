const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000;
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://fitness-b8a5d.web.app'],
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
    const communityCollection = client.db('fitness').collection('communitys');
    const paymentCollection = client.db('fitness').collection('payments');
    const subscriptionCollection = client.db('fitness').collection('subscriptions');
    const testimonialCollection = client.db('fitness').collection('testimonials');

    // Verify Admin 

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;

      const query = { email };
      const result = await userCollection.findOne(query)

      if (result.role !== 'admin') {
        return res.status(401).send({ message: 'Forbidden Access!' })
      }
      next()
    }

    const verifyTrainer = async (req, res, next) => {
      const email = req.user.email;

      const query = { email };
      const result = await userCollection.findOne(query)

      if (result.role !== 'trainer') {
        return res.status(401).send({ message: 'Forbidden Access!' })
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

    app.patch('/users', async(req, res) => {
      const users = req.body;
   
      const query = {email: users?.email};
      const updatedDoc = {
        $set: {
          name: users.name,
          image: users.image
        }
      }

      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result)
      
    })

    // Get All Trainer

   app.get('/trainer', async (req, res) => {

      const result = await trainerCollection.find().toArray();
      res.send(result);

    })

    app.get('/trainer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await trainerCollection.findOne(query);
      res.send(result)
    })

    app.post('/trainers', verifyToken, verifyAdmin, async (req, res) => {
      const user = req.body;
      const query = { email: user.email }

      const updatedDoc = {
        $set: {
          role: 'trainer'
        }
      }
      const roleUpdated = await userCollection.updateOne(query, updatedDoc);
      const result = await trainerCollection.insertOne(user);
      res.send(result)
    })

    app.delete('/trainer/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const emailQuery = { email: req.query.email };

   
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

    app.get('/trainers-email/:email', async (req, res) => {
      const email = req.params.email;
      // console.log('in trainer',email);
      // res.send({message: 'Suces'})
      const query = { email: email };
      const result = await trainerCollection.findOne(query);
      const appliedResult = await appliedTrainerCollection.findOne(query);
    // // console.log('result',result);
      res.send({result, appliedResult});
     
      
    })

    app.get('/trainers/:email', async(req, res) => {
      const email = req.params.email;
      const result = await trainerCollection.findOne({email});
      res.send(result)
    })

    app.put('/trainer/class',verifyToken, verifyTrainer, async (req, res) => {
      const { newSlot, classDetails } = req.body;

      const id = classDetails.trainerId

      const trainer = await trainerCollection.findOne({ _id: new ObjectId(id) })

      const { slots, time_in_day, classess } = trainer;
      let arr = [];

      if (slots) {
        arr = [...slots, newSlot]
      }
      else {
        arr = [newSlot]
      }
      console.log('inn arr ', arr);
      // console.log(arr, time_in_day, typeof time_in_day);
      const optiopns = { upsert: true };
      const updatedDoc = {
        $set: {
          slots: [...arr],
          time_in_day: time_in_day - newSlot.slotTime
        }
      }

      const result = await trainerCollection.updateOne({ _id: new ObjectId(id) }, updatedDoc, optiopns);

      for (const classes of classDetails.selectedClassess) {
        const query = { className: classes };
        const mainClass = await classCollection.findOne(query);
        const isExist = mainClass.teachers.find(item => item.id === classDetails.trainerId);
       
  
       if(!isExist){
        let array = [];
        const { teachers } = mainClass;
        const teacherCollec = {
          value: classDetails.trainerFullName,
          label: classDetails.trainerFullName,
          image: classDetails.trainerImage,
          id: classDetails.trainerId
        }
        console.log(teachers);
        if (teachers.length > 0) {

          array = [...teachers, teacherCollec]
        }
        else {
          array = [teacherCollec]
        }

        const updatedDoc2 = {
          $set: {
            teachers: [...array]
          }
        }
        const classResult = await classCollection.updateOne(query, updatedDoc2)
        console.log(classResult);

       }
      }
      res.send(result)


    })



    app.put('/trainer/slot/:email', async (req, res) => {
      const email = req.params.email;
      const index = parseInt(req.query.index);
      // console.log('in Slot', email, typeof index);
      const query = { email }
      const result = await trainerCollection.findOne(query);
      const newSlot = result.slots.filter((item, ind) => ind !== index)
      // console.log(newSlot);
      const optiopns = { upsert: true }
      const updatedDoc = {
        $set: {
          slots: [...newSlot]
        }
      }

      const updatedResult = await trainerCollection.updateOne(query, updatedDoc, optiopns);
      res.send(updatedResult)
    })

    // Applied Trainer

    app.get('/applied/:email', async(req, res) => {
      const email = req.params.email;
      console.log('in applied',email);
      const query = { email}
      const result = await appliedTrainerCollection.findOne(query);
      if(result){
        res.send(result)
      }
     else{
    
     }
    })

    app.get('/applied-trainers', verifyToken, verifyAdmin, async (req, res) => {
      const query = { status: 'pending' }
      const result = await appliedTrainerCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/applied-all-trainer', async(req, res) => {
      const result = await appliedTrainerCollection.find().toArray();
      res.send(result)
    })

    app.post('/applied-trainers', verifyToken, async (req, res) => {
      const user = req.body;
      // console.log('applied ', user);
      const result = await appliedTrainerCollection.insertOne(user);
      res.send(result)
      // res.send({success: true})
    })


    app.put('/admin-feedback', async(req, res) => {
      const { item , feedback } = req.body;
      // console.log(item, feedback);
      const id = item._id
      const query = { _id : new ObjectId(id)}
      const options = {upsert: true};
      const updatedDoc = {
        $set: {
          status : 'rejected',
          feedback: feedback
        }
      }

      const result = await appliedTrainerCollection.updateOne(query, updatedDoc, options);
      res.send(result)
    })


    app.delete('/applied-trainers/:id', verifyToken, verifyAdmin,  async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await appliedTrainerCollection.deleteOne(query);
      res.send(result);
    })

    // Classess

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.get('/allclassess', async(req, res) => {
      const result = await classCollection.find().sort({booked : -1}).toArray();
      res.send(result)
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

    // Community

    app.get('/community', async(req, res) => {
      const result = await communityCollection.find().toArray();
      res.send(result)
    })
    app.get('/community/time', async(req, res) => {
      const result = await communityCollection.find().sort({time: -1}).toArray();
      res.send(result)
    })

    app.get('/community-details/:id', async(req , res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await communityCollection.findOne(query);
      res.send(result)
    })

    app.post('/community', async(req, res) => {
      const data = req.body;
      const result = await communityCollection.insertOne(data);
      res.send(result)
    })

    // Subscription

    app.post('/subscription', async (req, res) => {
      const data = req.body;
      const result = await subscriptionCollection.insertOne(data);
      res.send(result)
    })

    app.get('/subscription', verifyToken, verifyAdmin, async (req, res) => {
      const result = await subscriptionCollection.find().toArray();
      res.send(result)
    })

    // Rating

    app.get('/review', async (req, res) => {
      const result = await testimonialCollection.find().toArray();
      res.send(result)
    })

    // Admin DashBoard 

    app.get('/admin-data',verifyToken, verifyAdmin, async(req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const classess = await classCollection.estimatedDocumentCount();
      const payments = await paymentCollection.estimatedDocumentCount();
      const uniqueUser = await paymentCollection.aggregate([
        {
          $group: {
            _id: '$email'
          }
        },
        {
          $count: 'uniqueUserCount'
        }
      ]).toArray();

      const uniqueSubs = await subscriptionCollection.aggregate([
        {
          $group: {
            _id: '$email'
          }
        },
        {
          $count: 'uniqueSubsCount'
        }
      ]).toArray();

      const uniqueSubsCount = uniqueSubs.length > 0 ? uniqueSubs[0].uniqueSubsCount : 0;

      const uniqueUserCount = uniqueUser.length > 0 ? uniqueUser[0].uniqueUserCount : 0;
      console.log('Users : ',uniqueUserCount);
      console.log('Subs : ',uniqueSubsCount);

      const paymentsItem = await paymentCollection.find().sort({time: -1}).toArray();
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalPrice: { $sum: '$price'}
          }
        }
      ]).toArray();
      const price=  result.length > 0 ? result[0].totalPrice : 0;
      console.log(price);
      
      res.send({
        users,
        classess,
        payments,
        price, 
        paymentsItem, 
        uniqueUserCount,
        uniqueSubsCount
      })
    })

    // Payment
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { price } = req.body;

      const totalPrice = parseFloat(price * 100)
      if (!price) return res.send({ message: 'Invalid price' });

      const { client_secret } = await stripe.paymentIntents.create({
        amount: totalPrice,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      })
      res.send({ clientSecret: client_secret })
    })

    app.post('/payments', async (req, res) => {
      const { payment, bookedDetails, trainer } = req.body;

  const paymentResult = await paymentCollection.insertOne(payment)


      // Class
      for (const className of payment.className) {
        const filter = { className }
        const singleClass = await classCollection.findOne(filter)
        // console.log(singleClass);
        const updatedDoc = {
          $set: {
            booked: singleClass?.booked + 1
          }
        }
        const result = await classCollection.updateOne(filter, updatedDoc);
        console.log(result);

      }
      const id = trainer._id;
      const singleTrainer = await trainerCollection.findOne({ _id: new ObjectId(id) })
      // console.log(singleTrainer);
      const optiopns = { upsert: true }
      const slotIndex = parseInt(bookedDetails.slotIndex);
     





      
      const updatePath = `slots.${slotIndex}.bookingDetails`;
      const updateDocument = {
        $set: { [updatePath]: bookedDetails }
      };
      // const result = await collection.updateOne(filter, update);

      const result = await trainerCollection.updateOne({_id: new ObjectId(id)}, updateDocument);
      res.send({paymentResult, result})
      

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