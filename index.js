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
    const bookmarkCollection = database.collection("bookmarks");
    const reportCollection = database.collection("reports");

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

    app.post("/api/prompts/:id/copy", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $inc: {
              copyCount: 1,
            },
          },
        );

        if (!result.modifiedCount) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        const updatedPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          copyCount: updatedPrompt.copyCount,
          message: "Prompt copied successfully.",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to update copy count.",
        });
      }
    });

    app.post("/api/prompts", async (req, res) => {
      try {
        const prompt = req.body;

        const addPrompt = {
          ...prompt,

          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await promptCollection.insertOne(addPrompt);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
        });
      }
    });

    app.post("/api/reports", async (req, res) => {
      try {
        const { promptId, userId, reason, description = "" } = req.body;

        // ==========================
        // Validation
        // ==========================

        if (!promptId || !reason) {
          return res.status(400).send({
            success: false,
            message: "Required fields are missing.",
          });
        }

        // const userId = session.user.id;

        // ==========================
        // Check Prompt Exists
        // ==========================

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(promptId),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        // ==========================
        // Prevent Reporting Own Prompt
        // ==========================

        if (prompt.userId?.toString() === userId.toString()) {
          return res.status(400).send({
            success: false,
            message: "You cannot report your own prompt.",
          });
        }

        // ==========================
        // Duplicate Report Check
        // ==========================

        const alreadyReported = await reportCollection.findOne({
          promptId,
          reportedBy: userId,
        });

        if (alreadyReported) {
          return res.status(400).send({
            success: false,
            message: "You already reported this prompt.",
          });
        }

        // ==========================
        // Save Report
        // ==========================

        const report = {
          promptId,
          reportedBy: userId,
          reason,
          description,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await reportCollection.insertOne(report);

        res.send({
          success: true,
          message: "Report submitted successfully.",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to submit report.",
        });
      }
    });

    app.delete("/api/reports/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await reportCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Delete failed.",
        });
      }
    });

    app.get("/api/prompts/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const prompts = await promptCollection
          .find({
            authorId: req.params.userId,
          })
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.send({
          success: true,
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

    app.patch("/api/reports/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const { status } = req.body;

        const result = await reportCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status,
            },
          },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Update failed.",
        });
      }
    });

    app.get("/api/bookmarks/:userId/:promptId", async (req, res) => {
      try {
        const { userId, promptId } = req.params;

        // Validation
        if (!userId || !promptId) {
          return res.status(400).send({
            success: false,
            message: "User ID and Prompt ID are required.",
          });
        }

        // Check bookmark exists
        const bookmark = await bookmarkCollection.findOne({
          userId,
          promptId,
        });

        return res.send({
          success: true,
          bookmarked: !!bookmark,
        });
      } catch (error) {
        console.error("Bookmark Status Error:", error);

        res.status(500).send({
          success: false,
          bookmarked: false,
          message: "Failed to check bookmark status.",
        });
      }
    });

    app.post("/api/bookmarks/toggle", async (req, res) => {
      try {
        const { userId, promptId } = req.body;

        if (!userId || !promptId) {
          return res.status(400).send({
            success: false,
            message: "User ID and Prompt ID are required.",
          });
        }

        // Check if bookmark already exists
        const existingBookmark = await bookmarkCollection.findOne({
          userId,
          promptId,
        });

        // ---------------------------------------
        // Remove Bookmark
        // ---------------------------------------

        if (existingBookmark) {
          await bookmarkCollection.deleteOne({
            _id: existingBookmark._id,
          });

          return res.send({
            success: true,
            bookmarked: false,
            message: "Bookmark removed successfully.",
          });
        }

        // ---------------------------------------
        // Add Bookmark
        // ---------------------------------------

        await bookmarkCollection.insertOne({
          userId,
          promptId,
          createdAt: new Date(),
        });

        return res.send({
          success: true,
          bookmarked: true,
          message: "Prompt bookmarked successfully.",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Bookmark toggle failed.",
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Love you");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
