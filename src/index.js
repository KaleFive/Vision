const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const Speech = require("ssml-builder");
const docClient = new AWS.DynamoDB.DocumentClient({ region: "us-east-1"});
const dynamodbstreams = new AWS.DynamoDBStreams({apiVersion: "2012-08-10"});

let lambdaCallback;

let handlers = {
  "LaunchRequest": function() {
    let speech = new Speech();
    speech.say("Hello")
    speech.pause("200ms")
    speech.say("My name is Paul Bettany, also known as")
    speech.pause("100ms")
    speech.say("the vision")
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
  "AvgAgeByFirstNameIntent": function() {
    alexa = this
    name = alexa.event.request.intent.slots.first_name.value
    avgAgeOfName(name)
      .then(function(age) {
        alexa.emit(":tell", "From my records, I would estimate " + name + " is " + age + "years old");
      }).catch(function(err) {
        alexa.emit(":tell", "I am sorry but I could not estimate the average ago of " + name);
      });
  },
  "FirstNameIntent": function() {
    alexa = this
    name = alexa.event.request.intent.slots.first_name.value
    updateLatestEntry(name)
      .then(function(data) {
        alexa.emit(":tell", name + " saved to the database");
      }).catch(function(err) {
        alexa.emit(":tell", "I am sorry but I could not save " + name + " to the database");
      });
  },
  "FirstNameCountIntent": function() {
    alexa = this
    name = alexa.event.request.intent.slots.first_name.value
    scanForName(name)
      .then(function(data) {
        nameCount = data["Count"]
        alexa.emit(":ask", "I found " + nameCount + " entries of " + name);
      }).catch(function(err) {
        alexa.emit(":tell", "I am sorry but I there was a problem trying to find instances of " + name);
      });
  },
  "GenderIntent": function () {
    this.emit(":tell", "I can say with " + genderConf + " percent confidence that this person is " + genderValue);
  },
  "LabelsIntent": function () {
    this.emit(":tell", "In this photo, I see " + labels);
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
  loadData(event, context);
};

function avgAgeOfName(name) {
  return scanForName(name)
          .then(function(data) {
            totalCount = data["Count"]
            totalAgeNumber = 0
            data["Items"].forEach(function(row) {
              totalAgeNumber = totalAgeNumber + row.ageLow
            });
            return new Promise(function(resolve, reject) {
              resolve(Math.round(totalAgeNumber / totalCount))
            })
          }).catch(function(err) {
            lambdaCallback(err, null);
          });
};

function scanForName(name) {
  params = {
    TableName: "facesV2",
    FilterExpression: "filename = :f1",
    ExpressionAttributeValues: { ":f1": name }
  }

  return docClient.scan(params).promise();
};

function updateLatestEntry(name) {
  return getLatestEntry()
          .then(function(data) {
            rawParams = data["Items"][0]
            rawParams["filename"] = name
            params = {
              TableName: "facesV2",
              Item: rawParams
            }

            return docClient.put(params).promise()
          }).catch(function(err) {
            lambdaCallback(err, null);
          });
};

function loadData(event, context) {
  getLatestEntry()
    .then(function(data) {
      target = data.Items[0]
      filename = target.filename;
      emotionType1 = target.emotionType1;
      emotionConf1 = Math.round(target.emotionConf1);
      emotionType2 = target.emotionType2;
      emotionConf2 = Math.round(target.emotionConf2);
      ageLow = target.ageLow;
      ageHigh = target.ageHigh;
      genderValue = target.genderValue;
      genderConf = target.genderConf;
      labels = target.labels;

      alexaFunction(event, context);
    }).catch(function(err) {
      lambdaCallback(err, null);
    });
};

function getLatestEntry() {
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
