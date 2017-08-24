const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const Speech = require("ssml-builder");
const docClient = new AWS.DynamoDB.DocumentClient({ region: "us-east-1"});
const dynamodbstreams = new AWS.DynamoDBStreams({apiVersion: "2012-08-10"});

let lambdaCallback;
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
  lambdaCallback = callback;
  // getTopics(callback, function() {
  //   alexaFunction(event, context);
  // });
  getLatestFace()
    .then(function(data) {
      lambdaCallback(null, data);
    }).catch(function(err) {
      lambdaCallback(err, null);
    });
};

function getLatestFace() {
  params = {
    TableName: "facesV2",
    ExpressionAttributeValues: { ":v1": 1 },
    KeyConditionExpression: "faceId = :v1",
    ScanIndexForward: false,
    Limit: 1
  };

  return docClient.query(params).promise()
};

function alexaFunction(event, context) {
  let alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers);
  alexa.execute();
};

function getLatestFromStream() {
  let streamArn = "arn:aws:dynamodb:us-east-1:351331127751:table/photos/stream/2017-08-24T04:37:16.067"
  let params = {
    StreamArn: streamArn
  };

  dynamodbstreams.describeStream(params).promise()
    .then(function(data) {
      let shardId = data["StreamDescription"]["Shards"][0]["ShardId"];
      return shardId
    }).then(function(shardId) {
      params = {
        ShardId: shardId,
        ShardIteratorType: "LATEST",
        StreamArn: streamArn
      }

      return getShardIterator(params);
    }).then(function(shardIterator) {
      params = {
        ShardIterator: shardIterator,
        Limit: 1
      }

      getRecords(params);
    }).catch(function(err) {
      console.log("Stream error: " + err);
    });
};

function getShardIterator(params) {
  return dynamodbstreams.getShardIterator(params).promise()
    .then(function(data) {
      let shardIterator = data["ShardIterator"]
      return shardIterator
    }).catch(function(err) {
      lambdaCallback(err, null)
    });
};

function getRecords(params) {
  return dynamodbstreams.getRecords(params).promise()
    .then(function(data) {
      lambdaCallback(null, data)
    }).catch(function(err) {
      lambdaCallback(err, null)
    });
};
