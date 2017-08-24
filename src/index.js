const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient({ region: "us-east-1"});
const dynamodbstreams = new AWS.DynamoDBStreams({apiVersion: "2012-08-10"});
const Speech = require("ssml-builder");

let topics;
let handlers = {
  "LaunchRequest": function() {
    let speech = new Speech();
    speech.say("I am the Vision, aka Paul Bettany.")
    speech.pause("500ms")
    speech.say("What would you like to know?")
    let speechOutput = speech.ssml(true);
    this.emit(":ask", speechOutput)
  },
  "TopicIntent": function () {
    this.emit(":tell", "Your last photo contained, " + topics);
  },
  "AMAZON.HelpIntent": function() {
    this.emit(":tell", "Ask me what is in your last photo!");
  }
}

exports.handler = (event, context, callback) => {
  // getTopics(callback, function() {
  //   alexaFunction(event, context);
  // });
  getLatestFromPhoto(callback);
};

function getLatestFromPhoto(lambdaCallback) {
  let streamArn = "arn:aws:dynamodb:us-east-1:351331127751:table/photos/stream/2017-08-24T04:37:16.067"
  let params = {
    StreamArn: streamArn
  };

  dynamodbstreams.describeStream(params).promise()
    .then(function(data) {
      console.log("## of shards ## " + data["StreamDescription"]["Shards"].length)
      let shardId = data["StreamDescription"]["Shards"][0]["ShardId"];
      return shardId
    }).then(function(shardId) {
      params = {
        ShardId: shardId,
        ShardIteratorType: "LATEST",
        StreamArn: streamArn
      }

      return dynamodbstreams.getShardIterator(params).promise()
        .then(function(data) {
          let shardIterator = data["ShardIterator"]
          return shardIterator
        }).catch(function(err) {
          lambdaCallback(err, null)
        });
    }).then(function(shardIterator) {
      params = {
        ShardIterator: shardIterator,
        Limit: 1
      }

      dynamodbstreams.getRecords(params, function(err, data) {
        if (err) {
          lambdaCallback(err, null)
        } else {
          lambdaCallback(null, data)
        };
      });
    }).catch(function(err) {
      console.log("Stream error: " + err);
    });
};

function getTopics(callback, alexaCallback) {
  setTimeout (function() {
    let params = {
      TableName: "photos",
      Key: {
        photoId: 2
      }
    };

    docClient.get(params, function(err, data) {
      if(err) {
        callback(err, null);
      } else {
        topics = data["Item"]["topics"];
        callback(null, topics);
      }
    });

    alexaCallback()

  }, 1000)
};

function alexaFunction(event, context) {
  let alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers);
  alexa.execute();
};
