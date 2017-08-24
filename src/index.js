const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const Speech = require("ssml-builder");
const docClient = new AWS.DynamoDB.DocumentClient({ region: "us-east-1"});
const dynamodbstreams = new AWS.DynamoDBStreams({apiVersion: "2012-08-10"});

let lambdaCallback, ageLow, ageHigh;
let handlers = {
  "LaunchRequest": function() {
    let speech = new Speech();
    speech.say("I am the Vision, aka Paul Bettany.")
    speech.pause("500ms")
    speech.say("What would you like to know?")
    let speechOutput = speech.ssml(true);
    this.emit(":ask", speechOutput)
  },
  "AgeIntent": function () {
    this.emit(":tell", "This person is somewhere around " + ageLow + " to " + ageHigh + " years old");
  },
  "EmotionIntent": function () {
    this.emit(":tell", "The latest photo shows someone who looks " + emotionType1 + " with a " + emotionConf1 + " percent confidence");
  },
  "GenderIntent": function () {
    this.emit(":tell", "I can say with " + genderConf + " percent confidence that this person is " + genderValue);
  },
  "AMAZON.CancelIntent": function() {
    this.emit(":tell", "Bye bye Felicia");
  },
  "AMAZON.HelpIntent": function() {
    this.emit(":tell", "Ask me what is in your last photo!");
  },
  "AMAZON.StopIntent": function() {
    this.emit(":tell", "Peace");
  }
}

exports.handler = (event, context, callback) => {
  lambdaCallback = callback;
  getLatestFace()
    .then(function(data) {
      target = data.Items[0]
      emotionType1 = target.emotionType1;
      emotionConf1 = Math.round(target.emotionConf1);
      ageLow = target.ageLow;
      ageHigh = target.ageHigh;
      genderValue = target.genderValue;
      genderConf = target.genderConf;
      alexaFunction(event, context);
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
