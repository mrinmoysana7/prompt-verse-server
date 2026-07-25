const express = require("express");
const app = express();
const cors = require("cors");
const port = 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Token Generation (logger)
// const logger = (req, res, next) => {
//   // console.log("logger middleware logged", req.params);
//   next();
// };

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
    const userCollection = database.collection("user");
    const reviewCollection = database.collection("reviews");
    const reportsCollection = database.collection("reports");
    const planCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const sessionCollection = database.collection("session");

    app.post("/api/auth/jwt", async (req, res) => {
      try {
        const { email } = req.body;

        const user = await userCollection.findOne({
          email,
        });

        if (!user) {
          return res.status(404).json({
            message: "User not found",
          });
        }

        const token = generateToken({
          id: user._id,
          email: user.email,
          role: user.role,
        });

        res.json({
          token,
        });
      } catch (err) {
        res.status(500).json({
          message: "Server Error",
        });
      }
    });

    // Verification related
    // Token Generation (verifyToken)
    // const verifyToken = async (req, res, next) => {
    //   // console.log("headers", req.headers);
    //   const authHeader = req.headers?.authorization;
    //   if (!authHeader) {
    //     return res.status(401).send({ message: "unathorized access" });
    //   }

    //   const token = authHeader.split(" ")[1];

    //   if (!token) {
    //     return res.status(401).send({ message: "unauthorized access" });
    //   }

    //   const query = { token: token };
    //   const session = await sessionCollection.findOne(query);

    //   const userId = session.userId;

    //   const userQuery = {
    //     _id: userId,
    //   };

    //   const user = await usersCollection.findOne(userQuery);
    //   // Set datain the req object
    //   req.user = user;

    //   next();
    // };

    // // Token Generation (verifySeeker)
    // const verifyUser = async (req, res, next) => {
    //   if (req.user?.role !== "user") {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   next();
    // };

    // const verifyCreator = async (req, res, next) => {
    //   if (req.user?.role !== "creator") {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   next();
    // };

    // const verifyAdmin = async (req, res, next) => {
    //   if (req.user?.role !== "admin") {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   next();
    // };

    app.get("/api/prompts/featured", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({
            status: "approved",
            featured: true,
          })
          .sort({ rating: -1, copyCount: -1 })
          .limit(6)
          .toArray();

        res.send({
          success: true,
          prompts,
        });
      } catch (error) {
        console.error("Featured Prompts Error:", error);

        res.status(500).send({
          success: false,
          message: error.message,
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
          limit = 100,
        } = req.query;

        // Search by title, description, aiToolName or tags
        const query = {
          status: "approved",
        };

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

        if (category) {
          query.category = category;
        }

        if (aiTool) {
          query.aiToolName = aiTool;
        }

        if (difficulty) {
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
          .sort(sort)

          // .sort({
          //   createdAt: -1,
          // })
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        const total = await promptCollection.countDocuments(query);

        const formattedPrompts = prompts.map((prompt) => ({
          ...prompt,
          _id: prompt._id.toString(),
        }));

        res.send({
          success: true,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          prompts: formattedPrompts,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch prompts.",
        });
      }
    });

    app.get("/api/prompts/count", async (req, res) => {
      try {
        const { userId } = req.query;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const count = await promptCollection.countDocuments({
          userId,
        });

        res.send({
          success: true,
          count,
        });
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Failed to fetch prompt count",
        });
      }
    });

    app.patch("/api/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID",
          });
        }

        const existingPrompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingPrompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        // Owner check
        if (existingPrompt.authorId !== updatedData.authorId) {
          return res.status(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        delete updatedData._id;

        updatedData.status = "pending";
        updatedData.updatedAt = new Date();

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: updatedData,
          },
        );

        res.send({
          success: true,
          message: "Prompt updated successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.delete("/api/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { authorId } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        // Owner check

        if (String(prompt.userId) !== String(authorId)) {
          return res.status(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // Delete bookmarks

        await bookmarkCollection.deleteMany({
          promptId: new ObjectId(id),
        });

        // Delete reports

        await reportCollection.deleteMany({
          promptId: new ObjectId(id),
        });

        const result = await promptCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          message: "Prompt deleted successfully.",
          deletedCount: result.deletedCount,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.get("/api/prompts/:id/analytics", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        const bookmarkCount = await bookmarkCollection.countDocuments({
          promptId: new ObjectId(id),
        });

        const reportCount = await reportCollection.countDocuments({
          promptId: new ObjectId(id),
        });

        res.send({
          success: true,
          analytics: {
            copies: prompt.copyCount || 0,
            bookmarks: bookmarkCount,
            rating: prompt.rating || 0,
            reviews: prompt.reviews || 0,
            reports: reportCount,
            views: prompt.views || 0,
            createdAt: prompt.createdAt,
          },
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // app.get("/api/prompts/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = {
    //     _id: new ObjectId(id),
    //     status: "approved",
    //   };
    //   const result = await promptCollection.findOne(query);
    //   res.send(result);
    // });

    // Ekhane change kora hoyeche
    // app.get("/api/prompts/:id", async (req, res) => {
    //   try {
    //     const { id } = req.params;

    //     // Validate ObjectId
    //     if (!ObjectId.isValid(id)) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "Invalid prompt id.",
    //       });
    //     }

    //     const prompt = await promptCollection.findOne({
    //       _id: new ObjectId(id),
    //       status: "approved",
    //     });

    //     if (!prompt) {
    //       return res.status(404).send({
    //         success: false,
    //         message: "Prompt not found.",
    //       });
    //     }

    //     // Convert _id to string
    //     prompt._id = prompt._id.toString();

    //     res.send({
    //       success: true,
    //       prompt,
    //     });
    //   } catch (error) {
    //     console.error(error);

    //     res.status(500).send({
    //       success: false,
    //       message: "Failed to load prompt.",
    //     });
    //   }
    // });

    app.get("/api/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid prompt id",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
          status: "approved",
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found",
          });
        }

        prompt._id = prompt._id.toString();

        res.send({
          success: true,
          prompt,
        });
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.post("/api/prompts/:id/copy", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID.",
          });
        }

        const result = await promptCollection.findOneAndUpdate(
          {
            _id: new ObjectId(id),
            status: "approved",
          },
          {
            $inc: {
              copyCount: 1,
            },
          },
          {
            returnDocument: "after",
          },
        );

        if (!result) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        res.status(200).send({
          success: true,
          message: "Copy count updated successfully.",
          promptId: result._id,
          copyCount: result.copyCount,
        });
      } catch (error) {
        console.error("Copy Prompt Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.post("/api/prompts", async (req, res) => {
      try {
        const prompt = req.body;

        const requiredFields = [
          "userId",
          "promptTitle",
          "fullDescription",
          "promptContent",
          "category",
          "aiToolName",
          "difficultyLevel",
          "visibility",
        ];

        for (const field of requiredFields) {
          if (
            !prompt[field] ||
            (typeof prompt[field] === "string" && !prompt[field].trim())
          ) {
            return res.status(400).send({
              success: false,
              message: `${field} is required.`,
            });
          }
        }

        if (!ObjectId.isValid(prompt.userId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user id.",
          });
        }

        const dbUser = await userCollection.findOne({
          _id: new ObjectId(prompt.userId),
        });

        if (!dbUser) {
          return res.status(404).send({
            success: false,
            message: "User not found.",
          });
        }

        const totalPrompts = await promptCollection.countDocuments({
          userId: prompt.userId,
        });

        if (dbUser.plan === "free" && totalPrompts >= 3) {
          return res.status(403).send({
            success: false,
            message:
              "Free plan allows only 3 prompts. Please upgrade to Premium.",
          });
        }

        const existingPrompt = await promptCollection.findOne({
          userId: prompt.userId,
          promptTitle: {
            $regex: `^${prompt.promptTitle.trim()}$`,
            $options: "i",
          },
        });

        if (existingPrompt) {
          return res.status(409).send({
            success: false,
            message: "You already have a prompt with this title.",
          });
        }

        const tags = Array.isArray(prompt.tags)
          ? prompt.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
          : [];

        const newPrompt = {
          userId: prompt.userId,

          creatorInformation: {
            id: dbUser._id.toString(),
            name: dbUser.name,
            email: dbUser.email,
            image: dbUser.image,
            username:
              dbUser.username || dbUser.email.split("@")[0].toLowerCase(),
            role: dbUser.role,
            plan: dbUser.plan,
            verified: dbUser.plan === "AI_Prompt_PRO_Access",
          },

          promptTitle: prompt.promptTitle.trim(),

          fullDescription: prompt.fullDescription.trim(),

          promptContent: prompt.promptContent.trim(),

          usageInstructions: prompt.usageInstructions?.trim() || "",

          category: prompt.category,

          aiToolName: prompt.aiToolName,

          difficultyLevel: prompt.difficultyLevel,

          visibility: prompt.visibility,

          image:
            prompt.thumbnailUrl ||
            prompt.image ||
            "https://i.ibb.co/VWwrxkxT/alex-dukhanov-1l2-ZSKCMDio-unsplash.jpg",

          tags,

          copyCount: 0,

          reviews: 0,

          rating: 0,

          status: "pending",

          feedback: "",

          createdAt: new Date(),

          updatedAt: new Date(),

          featured: false,

          reviewedBy: null,

          reviewedAt: null,

          approvedAt: null,

          rejectedAt: null,

          featuredAt: null,

          featuredBy: null,
        };

        const result = await promptCollection.insertOne(newPrompt);

        res.status(201).send({
          success: true,
          message: "Prompt submitted successfully.",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Create Prompt Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to create prompt.",
        });
      }
    });

    app.delete("/api/reports/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Report ID.",
          });
        }

        const report = await reportCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!report) {
          return res.status(404).send({
            success: false,
            message: "Report not found.",
          });
        }

        const result = await reportCollection.deleteOne({
          _id: new ObjectId(id),
        });

        await promptCollection.updateOne(
          {
            _id: new ObjectId(report.promptId),
          },
          {
            $inc: {
              reportCount: -1,
            },
          },
        );

        res.status(200).send({
          success: true,
          message: "Report deleted successfully.",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete Report Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.get("/api/prompts/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required.",
          });
        }

        const prompts = await promptCollection
          .find({
            userId,
          })
          .sort({
            createdAt: -1,
          })
          .toArray();

        const stats = {
          total: prompts.length,
          approved: prompts.filter((p) => p.status === "approved").length,
          pending: prompts.filter((p) => p.status === "pending").length,
          rejected: prompts.filter((p) => p.status === "rejected").length,
        };

        res.status(200).send({
          success: true,
          total: prompts.length,
          stats,
          prompts,
        });
      } catch (error) {
        console.error("Get User Prompts Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch user prompts.",
        });
      }
    });

    app.patch("/api/reports/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status, adminFeedback = "" } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Report ID.",
          });
        }

        const allowedStatus = ["pending", "reviewed", "resolved", "rejected"];

        if (!allowedStatus.includes(status)) {
          return res.status(400).send({
            success: false,
            message: "Invalid report status.",
          });
        }

        const report = await reportCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!report) {
          return res.status(404).send({
            success: false,
            message: "Report not found.",
          });
        }

        const result = await reportCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status,
              adminFeedback: adminFeedback.trim(),
              reviewedBy,
              reviewedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        res.status(200).send({
          success: true,
          message: "Report updated successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Update Report Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.get("/api/bookmarks/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required.",
          });
        }

        const savedPrompts = await bookmarkCollection
          .aggregate([
            {
              $match: {
                userId,
              },
            },

            {
              $sort: {
                createdAt: -1,
              },
            },

            {
              $lookup: {
                from: "prompts",
                localField: "promptId",
                foreignField: "_id",
                as: "prompt",
              },
            },

            {
              $unwind: {
                path: "$prompt",
                preserveNullAndEmptyArrays: false,
              },
            },

            {
              $project: {
                _id: "$prompt._id",

                promptTitle: "$prompt.promptTitle",

                fullDescription: "$prompt.fullDescription",

                promptContent: "$prompt.promptContent",

                category: "$prompt.category",

                aiToolName: "$prompt.aiToolName",

                difficultyLevel: "$prompt.difficultyLevel",

                visibility: "$prompt.visibility",

                image: "$prompt.image",

                tags: "$prompt.tags",

                rating: "$prompt.rating",

                reviews: "$prompt.reviews",

                copyCount: "$prompt.copyCount",

                bookmarkCount: "$prompt.bookmarkCount",

                status: "$prompt.status",

                creatorInformation: "$prompt.creatorInformation",

                bookmarkedAt: "$createdAt",
              },
            },
          ])
          .toArray();

        res.status(200).send({
          success: true,
          total: savedPrompts.length,
          prompts: savedPrompts,
        });
      } catch (error) {
        console.error("Get Saved Prompts Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.get("/api/bookmarks/:userId/:promptId", async (req, res) => {
      try {
        const { userId, promptId } = req.params;

        if (!userId || !promptId) {
          return res.status(400).send({
            success: false,
            message: "User ID and Prompt ID are required.",
          });
        }

        if (!ObjectId.isValid(promptId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID.",
          });
        }

        const bookmark = await bookmarkCollection.findOne(
          {
            userId,
            promptId: new ObjectId(promptId),
            status: "approved",
          },
          {
            projection: {
              _id: 1,
            },
          },
        );

        res.status(200).send({
          success: true,
          bookmarked: Boolean(bookmark),
        });
      } catch (error) {
        console.error("Bookmark Status Error:", error);

        res.status(500).send({
          success: false,
          bookmarked: false,
          message: "Internal Server Error.",
        });
      }
    });        

    app.post("/api/bookmarks/toggle", async (req, res) => {
      try {
        console.log("BODY =>", req.body);
        const { userId, promptId } = req.body;

        // ==========================================
        // Required Field Validation
        // ==========================================

        if (!userId || !promptId) {
          return res.status(400).send({
            success: false,
            message: "User ID and Prompt ID are required.",
          });
        }

        // ==========================================
        // Validate Prompt ID
        // ==========================================

        if (!ObjectId.isValid(promptId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID.",
          });
        }

        // ==========================================
        // Check Prompt Exists
        // ==========================================

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(promptId),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        // ==========================================
        // Prevent Bookmarking Own Prompt
        // ==========================================

        if (prompt.userId === userId) {
          return res.status(400).send({
            success: false,
            message: "You cannot bookmark your own prompt.",
          });
        }

        // ==========================================
        // Check Existing Bookmark
        // ==========================================

        const existingBookmark = await bookmarkCollection.findOne({
          userId,
          promptId: new ObjectId(promptId),
        });

        // ==========================================
        // Remove Bookmark
        // ==========================================

        if (existingBookmark) {
          await bookmarkCollection.deleteOne({
            _id: existingBookmark._id,
          });

          // Update bookmark count
          await promptCollection.updateOne(
            {
              _id: new ObjectId(promptId),
            },
            {
              $inc: {
                bookmarkCount: -1,
              },
            },
          );

          return res.status(200).send({
            success: true,
            bookmarked: false,
            message: "Bookmark removed successfully.",
          });
        }

        // ==========================================
        // Create Bookmark
        // ==========================================

        await bookmarkCollection.insertOne({
          userId,
          promptId: new ObjectId(promptId),
          createdAt: new Date(),
        });

        // Update bookmark count
        await promptCollection.updateOne(
          {
            _id: new ObjectId(promptId),
          },
          {
            $inc: {
              bookmarkCount: 1,
            },
          },
        );

        // ==========================================
        // Success Response
        // ==========================================

        res.status(201).send({
          success: true,
          bookmarked: true,
          message: "Prompt bookmarked successfully.",
        });
      } catch (error) {
        console.error("Toggle Bookmark Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.delete("/api/bookmarks/remove", async (req, res) => {
      try {
        const { userId, promptId } = req.body;

        if (!userId || !promptId) {
          return res.status(400).send({
            success: false,
            message: "User ID and Prompt ID are required.",
          });
        }

        if (!ObjectId.isValid(promptId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID.",
          });
        }

        const bookmark = await bookmarkCollection.findOne({
          userId,
          promptId: new ObjectId(promptId),
        });

        if (!bookmark) {
          return res.status(404).send({
            success: false,
            message: "Bookmark not found.",
          });
        }

        const result = await bookmarkCollection.deleteOne({
          _id: bookmark._id,
        });

        await promptCollection.updateOne(
          {
            _id: new ObjectId(promptId),
          },
          {
            $inc: {
              bookmarkCount: -1,
            },
          },
        );

        res.status(200).send({
          success: true,
          message: "Bookmark removed successfully.",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Remove Bookmark Error:", error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error.",
        });
      }
    });

    app.get("/api/profile/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        console.log("Requested User ID:", userId);

        console.log("Is Valid ObjectId:", ObjectId.isValid(userId));

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required.",
          });
        }
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });

        console.log("Found User:", user);

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found.",
          });
        }

        const totalPrompts = await promptCollection.countDocuments({
          userId,
        });

        res.status(200).send({
          success: true,

          profile: {
            _id: user._id,

            name: user.name,

            email: user.email,

            image: user.image,

            role: user.role,

            plan: user.plan,

            totalPrompts,
          },
        });
      } catch (error) {
        console.error("Profile API Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch profile.",
        });
      }
    });

    app.get("/api/prompts/:id/reviews", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID",
          });
        }

        const reviews = await reviewCollection
          .find({
            promptId: new ObjectId(id),
          })
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.send({
          success: true,
          reviews,
        });
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.post("/api/prompts/:id/reviews", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt ID",
          });
        }

        const { userId, userName, userImage, rating, comment } = req.body;

        if (!userId || !rating || !comment) {
          return res.status(400).send({
            success: false,
            message: "Missing required fields.",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found.",
          });
        }

        const exists = await reviewCollection.findOne({
          promptId: new ObjectId(id),
          status: "approved",
          userId,
        });

        if (exists) {
          return res.status(409).send({
            success: false,
            message: "You already reviewed this prompt.",
          });
        }

        const review = {
          promptId: new ObjectId(id),

          userId,

          userName,

          userImage,

          rating: Number(rating),

          comment,

          createdAt: new Date(),
        };

        const result = await reviewCollection.insertOne(review);

        const insertedReview = await reviewCollection.findOne({
          _id: result.insertedId,
        });

        const allReviews = await reviewCollection
          .find({
            promptId: new ObjectId(id),
          })
          .toArray();

        const totalRating = allReviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        );

        const averageRating = Number(
          (totalRating / allReviews.length).toFixed(1),
        );

        await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              rating: averageRating,
              reviews: allReviews.length,
            },
          },
        );

        res.send({
          success: true,
          review: insertedReview,
          message: "Review submitted successfully.",
        });
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.get("/api/reviews/homepage", async (req, res) => {
      try {
        const reviews = await reviewCollection
          .aggregate([
            // Prompt Join
            {
              $lookup: {
                from: "prompts",
                localField: "promptId",
                foreignField: "_id",
                as: "prompt",
              },
            },

            // Convert array -> object
            {
              $unwind: "$prompt",
            },

            // Only approved prompts
            {
              $match: {
                "prompt.status": "approved",
              },
            },

            // Newest first
            {
              $sort: {
                createdAt: -1,
              },
            },

            // Homepage only
            {
              $limit: 6,
            },

            // Response
            {
              $project: {
                _id: 1,

                rating: 1,

                comment: 1,

                createdAt: 1,

                userName: 1,

                userImage: 1,

                promptTitle: "$prompt.promptTitle",

                promptImage: "$prompt.image",

                promptId: "$prompt._id",
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          reviews,
        });
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Failed to load homepage reviews.",
        });
      }
    });

    app.patch("/api/prompts/:id/resubmit", async (req, res) => {
      try {
        const { id } = req.params;

        const { userId } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
          });
        }

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
            userId,
          },
          {
            $set: {
              status: "pending",
              feedback: "",
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
        });
      }
    });

    app.get("/api/prompts/:id/feedback", async (req, res) => {
      try {
        const { id } = req.params;

        const prompt = await promptCollection.findOne(
          {
            _id: new ObjectId(id),
          },
          {
            projection: {
              feedback: 1,
              status: 1,
              reviewedAt: 1,
              reviewedBy: 1,
            },
          },
        );

        res.send({
          success: true,
          feedback: prompt,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    app.get("/api/reviews/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const reviews = await reviewCollection
          .aggregate([
            {
              $match: {
                userId,
              },
            },
            {
              $lookup: {
                from: "prompts",
                localField: "promptId",
                foreignField: "_id",
                as: "prompt",
              },
            },
            {
              $unwind: "$prompt",
            },
            {
              $project: {
                _id: 1,
                rating: 1,
                comment: 1,
                createdAt: 1,

                promptId: "$prompt._id",
                promptTitle: "$prompt.promptTitle",
                aiToolName: "$prompt.aiToolName",
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          reviews,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.get("/api/creator/:userId/analytics", async (req, res) => {
      try {
        const { userId } = req.params;

        const prompts = await promptCollection
          .find({
            userId,
          })
          .toArray();

        const totalPrompts = prompts.length;

        const totalCopies = prompts.reduce(
          (sum, prompt) => sum + (prompt.copyCount || 0),
          0,
        );

        const promptIds = prompts.map((p) => p._id);

        const totalBookmarks = await bookmarkCollection.countDocuments({
          promptId: {
            $in: promptIds,
          },
        });

        res.send({
          success: true,

          analytics: {
            totalPrompts,
            totalCopies,
            totalBookmarks,
            prompts,
          },
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.get("/api/creator/:userId/stats", async (req, res) => {
      try {
        const { userId } = req.params;

        const total = await promptCollection.countDocuments({
          userId,
        });

        const pending = await promptCollection.countDocuments({
          userId,
          status: "pending",
        });

        const approved = await promptCollection.countDocuments({
          userId,
          status: "approved",
        });

        const rejected = await promptCollection.countDocuments({
          userId,
          status: "rejected",
        });

        res.send({
          success: true,
          stats: {
            total,
            pending,
            approved,
            rejected,
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    app.get("/api/admin/users", async (req, res) => {
      try {
        const users = await userCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          success: true,
          users,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch users.",
        });
      }
    });

    app.patch("/api/admin/users/:id/role", async (req, res) => {
      try {
        console.log("BODY:", req.body);
        console.log("ROLE:", req.body.role);
        const { id } = req.params;
        const { role } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user id.",
          });
        }

        const validRoles = ["user", "creator", "admin"];

        if (!validRoles.includes(role?.toLowerCase())) {
          return res.status(400).send({
            success: false,
            message: "Invalid role.",
          });
        }

        const result = await userCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              role,
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Role updated successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to update role.",
        });
      }
    });

    app.delete("/api/admin/users/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user id.",
          });
        }

        const user = await userCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found.",
          });
        }

        if (user.role === "admin") {
          return res.status(403).send({
            success: false,
            message: "Admin account cannot be deleted.",
          });
        }

        const result = await userCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          message: "User deleted successfully.",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to delete user.",
        });
      }
    });

    app.get("/api/admin/prompts/stats", async (req, res) => {
      try {
        const total = await promptCollection.countDocuments();

        const pending = await promptCollection.countDocuments({
          status: "pending",
        });

        const approved = await promptCollection.countDocuments({
          status: "approved",
        });

        const rejected = await promptCollection.countDocuments({
          status: "rejected",
        });

        const featured = await promptCollection.countDocuments({
          featured: true,
          status: "approved",
        });

        res.send({
          success: true,
          stats: {
            total,
            pending,
            approved,
            rejected,
            featured,
          },
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed to load prompt statistics.",
        });
      }
    });

    app.get("/api/admin/prompts", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({})
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

    app.get("/api/admin/prompts/pending", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({
            status: "pending",
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
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed",
        });
      }
    });

    app.get("/api/admin/prompts/approved", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({
            status: "approved",
          })
          .sort({
            approvedAt: -1,
          })
          .toArray();

        res.send({
          success: true,
          prompts,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    app.patch("/api/admin/prompts/:id/approve", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid prompt id.",
          });
        }

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "approved",
              feedback: "",
              approvedAt: new Date(),
              updatedAt: new Date(),
              reviewedBy: req.body?.adminEmail || "Admin",
              reviewedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Prompt approved successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error approving prompt:", error);

        res.status(500).send({
          success: false,
          message: "Failed to approve prompt.",
        });
      }
    });

    app.get("/api/admin/prompts/rejected", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({
            status: "rejected",
          })
          .sort({
            rejectedAt: -1,
          })
          .toArray();

        res.send({
          success: true,
          prompts,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
        });
      }
    });

    app.patch("/api/admin/prompts/:id/reject", async (req, res) => {
      try {
        const { id } = req.params;

        const { feedback } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid prompt id.",
          });
        }

        if (!feedback?.trim()) {
          return res.status(400).send({
            success: false,
            message: "Feedback is required.",
          });
        }

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "rejected",
              feedback,
              reviewedBy: req.body.adminEmail,
              reviewedAt: new Date(),
              rejectedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Prompt rejected.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to reject prompt.",
        });
      }
    });

    app.patch("/api/admin/prompts/:id/feature", async (req, res) => {
      try {
        const { id } = req.params;

        const { featured } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid prompt id.",
          });
        }

        const result = await promptCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              featured,
              updatedAt: new Date(),
              featuredBy: req.body.adminEmail,
              featuredAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: featured ? "Prompt featured." : "Prompt unfeatured.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to update feature.",
        });
      }
    });

    app.get("/api/admin/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid Prompt Id",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!prompt) {
          return res.status(404).send({
            success: false,
            message: "Prompt not found",
          });
        }

        res.send({
          success: true,
          prompt,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.delete("/api/admin/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid prompt id.",
          });
        }

        const prompt = await promptCollection.findOne({
          _id: new ObjectId(id),
        });

        const result = await promptCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          message: "Prompt deleted successfully.",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to delete prompt.",
        });
      }
    });

    app.get("/api/admin/analytics", async (req, res) => {
      try {
        const totalUsers = await userCollection.countDocuments();

        const totalPrompts = await promptCollection.countDocuments();

        const approvedPrompts = await promptCollection.countDocuments({
          status: "approved",
        });

        const engineAnalytics = await promptCollection
          .aggregate([
            {
              $group: {
                _id: "$aiToolName",

                prompts: {
                  $sum: 1,
                },

                copies: {
                  $sum: "$copyCount",
                },
              },
            },
            {
              $project: {
                _id: 0,
                engine: "$_id",
                prompts: 1,
                copies: 1,
              },
            },
          ])
          .toArray();

        const totalReviews = await reviewCollection.countDocuments();

        const copies = await promptCollection
          .aggregate([
            {
              $group: {
                _id: null,
                total: {
                  $sum: "$copyCount",
                },
              },
            },
          ])
          .toArray();

        const totalCopies = copies[0]?.total || 0;

        const premiumUsers = await userCollection.countDocuments({
          plan: "Premium",
        });

        const payments = await subscriptionCollection
          .find({
            status: "paid",
          })
          .toArray();

        const totalRevenue = payments.reduce(
          (sum, payment) => sum + (payment.amount || 0),
          0,
        );

        res.send({
          success: true,

          analytics: {
            totalUsers,
            totalPrompts,
            approvedPrompts,
            engineAnalytics,
            totalReviews,
            totalCopies,
            totalRevenue,
          },
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed to load analytics.",
        });
      }
    });

    app.post("/api/reports", async (req, res) => {
      try {
        const report = req.body;

        const requiredFields = [
          "promptId",
          "promptTitle",
          "creator",
          "reporter",
          "reason",
          "description",
        ];

        for (const field of requiredFields) {
          if (!report[field]) {
            return res.status(400).send({
              success: false,
              message: `${field} is required.`,
            });
          }
        }

        // Prevent duplicate report from the same user

        const existingReport = await reportsCollection.findOne({
          promptId: report.promptId,
          "reporter.id": report.reporter.id,
          status: "pending",
        });

        if (existingReport) {
          return res.status(409).send({
            success: false,
            message: "You have already reported this prompt.",
          });
        }

        const newReport = {
          promptId: report.promptId,

          promptTitle: report.promptTitle,

          promptImage: report.promptImage,

          creator: report.creator,

          reporter: report.reporter,

          reason: report.reason,

          description: report.description,

          status: "pending",

          warningSent: false,

          createdAt: new Date(),

          updatedAt: new Date(),
        };

        const result = await reportsCollection.insertOne(newReport);

        res.status(201).send({
          success: true,
          message: "Report submitted successfully.",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: "Failed to submit report.",
        });
      }
    });

    app.get("/api/admin/reports", async (req, res) => {
      const REPORT_STATUS = {
        PENDING: "pending",
        RESOLVED: "resolved",
        DISMISSED: "dismissed",
      };

      try {
        const reports = await reportsCollection
          .find({
            status: REPORT_STATUS.PENDING,
          })
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.send({
          success: true,
          reports,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch reported prompts.",
        });
      }
    });

    app.patch("/api/admin/reports/:id/warn", async (req, res) => {
      const REPORT_STATUS = {
        PENDING: "pending",
        RESOLVED: "resolved",
        DISMISSED: "dismissed",
      };
      try {
        const { id } = req.params;

        const { message } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid report id.",
          });
        }

        const report = await reportsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!report) {
          return res.status(404).send({
            success: false,
            message: "Report not found.",
          });
        }

        await reportsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: REPORT_STATUS.RESOLVED,
              warningSent: true,
              warningMessage: message,
              warnedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Warning sent successfully.",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to warn creator.",
        });
      }
    });

    app.delete("/api/admin/reports/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid report id.",
          });
        }

        const result = await reportsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (!result.deletedCount) {
          return res.status(404).send({
            success: false,
            message: "Report not found.",
          });
        }

        res.send({
          success: true,
          message: "Report removed successfully.",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to remove report.",
        });
      }
    });

    app.patch("/api/admin/reports/:id/dismiss", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid report id.",
          });
        }

        const report = await reportsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!report) {
          return res.status(404).send({
            success: false,
            message: "Report not found.",
          });
        }

        await reportsCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              status: "dismissed",
              dismissedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );

        res.send({
          success: true,
          message: "Report dismissed successfully.",
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to dismiss report.",
        });
      }
    });

    app.get("/api/plans", async (req, res) => {
      try {
        const query = {};

        if (req.query.plan_id) {
          query.plan_id = req.query.plan_id;
        }

        const plan = await planCollection.findOne(query);

        res.send(plan || null);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch plan.",
        });
      }
    });

    app.post("/api/subscriptions", async (req, res) => {
      try {
        const {
          sessionId,
          paymentIntent,
          userId,
          email,
          planId,
          amount,
          currency,
          status,
        } = req.body;

        /* =====================================
       Validation
    ===================================== */

        if (!sessionId || !paymentIntent || !userId || !email || !planId) {
          return res.status(400).send({
            success: false,
            message: "Missing required fields.",
          });
        }

        /* =====================================
       Verify User
    ===================================== */

        const user = await userCollection.findOne({
          email,
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found.",
          });
        }

        /* =====================================
       Update user plan first
    ===================================== */

        await userCollection.updateOne(
          {
            _id: user._id,
          },
          {
            $set: {
              plan: planId,
              updatedAt: new Date(),
            },
          },
        );

        /* =====================================
       Prevent duplicate subscription
    ===================================== */

        const existingSubscription = await subscriptionCollection.findOne({
          sessionId,
        });

        if (existingSubscription) {
          return res.send({
            success: true,
            message: "Subscription already exists.",
          });
        }

        /* =====================================
       Create Subscription
    ===================================== */

        const subscription = {
          sessionId,
          paymentIntent,

          userId: user._id.toString(),

          email: user.email,

          purchaser: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            image: user.image || "",
          },

          planId,

          amount,

          currency,

          status,

          createdAt: new Date(),
        };

        const insertResult =
          await subscriptionCollection.insertOne(subscription);

        return res.send({
          success: true,
          message: "Subscription created successfully.",
          insertedId: insertResult.insertedId,
        });
      } catch (error) {
        console.error("Subscription Error:", error);

        return res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/subscriptions", async (req, res) => {
      try {
        const payments = await subscriptionCollection
          .find({})
          .sort({
            createdAt: -1,
          })
          .toArray();

        res.send(
          payments.map((payment) => ({
            _id: payment._id,

            sessionId: payment.sessionId,

            paymentIntent: payment.paymentIntent,

            userId: payment.userId,

            email: payment.email,

            planId: payment.planId,

            // role: updatedUser.role,

            amount: payment.amount ?? 0,

            currency: payment.currency ?? "usd",

            status: payment.status ?? "pending",

            createdAt: payment.createdAt,

            purchaser: {
              id: payment.purchaser?.id ?? "",

              name: payment.purchaser?.name ?? "Unknown User",

              email: payment.purchaser?.email ?? payment.email,

              image: payment.purchaser?.image ?? "",
            },
          })),
        );
      } catch (err) {
        console.error(err);

        res.status(500).send({
          success: false,
          message: "Failed to load payments.",
        });
      }
    });

    app.get("/api/users/top-creators", async (req, res) => {
      try {
        const creators = await userCollection
          .aggregate([
            // শুধুমাত্র Premium Creator
            {
              $match: {
                role: "creator",
                plan: "AI_Prompt_PRO_Access",
              },
            },

            // Prompt Join
            {
              $lookup: {
                from: "prompts",
                let: {
                  creatorId: {
                    $toString: "$_id",
                  },
                },
                pipeline: [
                  {
                    $match: {
                      status: "approved",
                    },
                  },
                  {
                    $match: {
                      $expr: {
                        $eq: ["$creatorInformation.id", "$$creatorId"],
                      },
                    },
                  },
                ],
                as: "prompts",
              },
            },

            // Statistics
            {
              $addFields: {
                promptCount: {
                  $size: "$prompts",
                },

                copies: {
                  $sum: "$prompts.copyCount",
                },

                reviews: {
                  $sum: "$prompts.reviews",
                },

                rating: {
                  $round: [
                    {
                      $ifNull: [
                        {
                          $avg: "$prompts.rating",
                        },
                        0,
                      ],
                    },
                    1,
                  ],
                },
              },
            },

            // Score
            {
              $addFields: {
                creatorScore: {
                  $add: [
                    {
                      $multiply: ["$promptCount", 50],
                    },
                    {
                      $multiply: ["$copies", 2],
                    },
                    {
                      $multiply: ["$reviews", 5],
                    },
                    {
                      $multiply: ["$rating", 100],
                    },
                  ],
                },
              },
            },

            // Highest Score
            {
              $sort: {
                creatorScore: -1,
              },
            },

            // Top 3
            {
              $limit: 3,
            },

            // Response
            {
              $project: {
                _id: {
                  $toString: "$_id",
                },

                name: 1,

                email: 1,

                username: {
                  $ifNull: [
                    "$username",
                    {
                      $toLower: {
                        $replaceAll: {
                          input: "$name",
                          find: " ",
                          replacement: "",
                        },
                      },
                    },
                  ],
                },

                avatar: "$image",

                role: 1,

                plan: 1,

                promptCount: 1,

                copies: 1,

                reviews: 1,

                rating: 1,

                verified: true,
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          creators,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to load top creators.",
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
