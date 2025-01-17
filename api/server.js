const express = require("express");
const app = express();
const { MongoClient } = require("mongodb");
const cors = require("cors");
const getData = require("./modules/getData.js");
const fs = require("fs");
const {
  port,
  URI,
  database,
  collection,
  screenshotDirectory,
  pdfDirectory,
} = require("./config.js");
const fetch = require("cross-fetch");
const sanitize = require("sanitize-filename");

const client = new MongoClient(URI);
const db = client.db(database);
const list = db.collection(collection);

// Create the storage directories if they do not exist
if (!fs.existsSync(screenshotDirectory)) {
  fs.mkdirSync(screenshotDirectory, { recursive: true });
}

if (!fs.existsSync(pdfDirectory)) {
  fs.mkdirSync(pdfDirectory, { recursive: true });
}

app.use(cors());

app.use(express.json());

app.get("/api", async (req, res) => {
  const data = await getDoc();
  res.send(data);
});

app.get("/screenshots/:id", async (req, res) => {
  res.sendFile(
    __dirname + "/" + screenshotDirectory + "/" + sanitize(req.params.id),
    (err) => {
      if (err) {
        res.sendFile(__dirname + "/pages/404.html");
      }
    }
  );
});

app.get("/pdfs/:id", async (req, res) => {
  res.sendFile(
    __dirname + "/" + pdfDirectory + "/" + sanitize(req.params.id),
    (err) => {
      if (err) {
        res.sendFile(__dirname + "/pages/404.html");
      }
    }
  );
});

app.post("/api", async (req, res) => {
  const pageToVisit = req.body.link;
  const id = req.body._id;
  const getTitle = async (url) => {
    let body;
    await fetch(url)
      .then((res) => res.text())
      .then((text) => (body = text));
    // regular expression to parse contents of the <title> tag
    let match = body.match(/<title.*>([^<]*)<\/title>/);
    return match[1];
  };

  try {
    req.body.title = await getTitle(req.body.link);
    await insertDoc(req.body);

    res.send("DONE!");
    getData(pageToVisit, req.body._id);
  } catch (err) {
    console.log(err);
    insertDoc(req.body);
  }
});

app.put("/api", async (req, res) => {
  const id = req.body._id;

  await updateDoc(id, req.body);

  res.send("Updated!");
});

app.delete("/api", async (req, res) => {
  const id = req.body.id;

  await deleteDoc(id);

  res.send(`Bookmark with _id:${id} deleted.`);
});

async function updateDoc(id, updatedListing) {
  try {
    await list.updateOne({ _id: id }, { $set: updatedListing });
  } catch (err) {
    console.log(err);
  }
}

async function insertDoc(doc) {
  try {
    await list.insertOne(doc);
  } catch (err) {
    console.log(err);
  }
}

async function getDoc() {
  try {
    const result = await list.find({}).toArray();

    return result;
  } catch (err) {
    console.log(err);
  }
}

async function deleteDoc(doc) {
  doc = sanitize(doc);
  try {
    const result = await list.deleteOne({ _id: doc });

    fs.unlink(screenshotDirectory + "/" + doc + ".png", (err) => {
      if (err) {
        console.log(err);
      }
    });

    fs.unlink(pdfDirectory + "/" + doc + ".pdf", (err) => {
      if (err) {
        console.log(err);
      }
    });

    return result;
  } catch (err) {
    console.log(err);
  }
}

app.listen(port, () => {
  console.log(`Success! running on port ${port}.`);
  client.connect();
});
