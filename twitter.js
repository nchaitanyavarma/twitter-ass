const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DATABASE ERROR ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const validPassword = (password) => {
  return password.length < 6;
};

//API 1 ("/register/")

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const getQuery = `
    SELECT 
      * 
    FROM 
      user
    where username = '${username}';`;

  const dbUser = await db.get(getQuery);
  //console.log(password);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (validPassword(password)) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const updateQuery = `
        INSERT INTO
          user (name , username , password , gender)
        VALUES 
            (
               '${name}',
               '${username}',
               '${hashedPassword}',
               '${gender}'

            )`;
    await db.run(updateQuery);
    response.send("User created successfully");
  }
});

//API 2 ("/login/")

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getQuery = `

    SELECT * FROM user
    WHERE username = '${username}';`;

  const dbUser = await db.get(getQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "12345");
      response.send({ jwtToken });
    }
  }
});

//Authentication with JWT Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  // console.log(authHeader);

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    //  console.log(jwtToken);
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "12345", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 3 ("/user/tweets/feed/")
const responsePattern = (obj) => {
  return {
    username: obj.username,
    tweet: obj.tweet,
    dateTime: obj.date_time,
  };
};

//API3 "/user/tweets/feed/"

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getQuery = `
  SELECT 
    * 
  FROM 
    user 
  INNER JOIN 
    tweet
  ON 
    user.user_id = tweet.user_id
  INNER JOIN 
    follower 
  ON 
    user.user_id = follower.follower_user_id
    WHERE 
    user.user_id=follower.follower_user_id
  GROUP BY user.user_id
  ORDER BY tweet.date_time DESC
  LIMIT 4
  ;
  `;

  const result = await db.all(getQuery);
  response.send(result.map((eachItem) => responsePattern(eachItem)));
});

const response = (obj) => {
  return {
    name: obj.name,
  };
};

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT * FROM 
      user INNER JOIN follower
    ON user.user_id = follower.follower_user_id
    
    WHERE user.user_id = follower.follower_user_id
    AND follower.follower_user_id !=follower.following_user_id
    GROUP BY user.user_id
    ORDER BY tweet.date_time 
    ;`;
  const result = await db.all(getQuery);
  response.send(result.map((eachItem) => response(eachItem)));
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT * FROM 
      user INNER JOIN follower
    ON user.user_id = follower.follower_user_id
    
    WHERE 
    user.user_id = follower.following_user_id AND follower.follower_user_id != follower.following_user_id
    GROUP BY user.user_id
    ORDER BY tweet.date_time;`;
  const result = await db.all(getQuery);
  response.send(result.map((eachItem) => response(eachItem)));
});

module.exports = app;
