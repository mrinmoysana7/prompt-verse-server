const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const database = client.db("PromptVerse");
    const promptCollection = database.collection("prompts");

    app.get("/api/prompts/featured", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({})
          .sort({ rating: -1, copyCount: -1 })
          .limit(6)
          .toArray();

        res.send({
          success: true,
          prompts,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Failed to fetch featured prompts",
        });
      }
    });

    app.get("/api/prompts", async (req, res) => {
      try {
        const {
          search = "",
          category,
          aiTool,
          difficulty,
          sort = "newest",
          page = 1,
          limit = 30,
        } = req.query;

        const query = {};

        // Search by title, description, aiToolName or tags
        if (search) {
          query.$or = [
            {
              promptTitle: {
                $regex: search,
                $options: "i",
              },
            },
            {
              fullDescription: {
                $regex: search,
                $options: "i",
              },
            },
            {
              aiToolName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              tags: {
                $elemMatch: {
                  $regex: search,
                  $options: "i",
                },
              },
            },
          ];
        }

        // Category Filter
        if (category && category !== "all") {
          query.category = category;
        }

        // AI Tool Filter
        if (aiTool && aiTool !== "all") {
          query.aiToolName = aiTool;
        }

        // Difficulty Filter
        if (difficulty && difficulty !== "all") {
          query.difficultyLevel = difficulty;
        }

        // Sorting
        let sortOption = {};

        switch (sort) {
          case "rating":
            sortOption = { rating: -1 };
            break;

          case "copies":
            sortOption = { copyCount: -1 };
            break;

          case "reviews":
            sortOption = { reviews: -1 };
            break;

          case "title":
            sortOption = { promptTitle: 1 };
            break;

          default:
            sortOption = { _id: -1 };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const prompts = await promptCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        const total = await promptCollection.countDocuments(query);

        res.send({
          success: true,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / limit),
          prompts,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch prompts.",
        });
      }
    });

    app.get("/api/prompts/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await promptCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/prompts", async (req, res) => {
      const prompt = req.body;
      const addPrompt = {
        ...prompt,
        createdAt: new Date(),
      };
      const result = await promptCollection.insertOne(prompt);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Fuck you!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
