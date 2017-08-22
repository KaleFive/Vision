const Alexa = require("alexa-sdk");
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient({ region: "us-east-1"});

var topics;
var handlers = {
  'LaunchRequest': function () {
    this.emit(':tell', 'Hello World');
  },
  'TopicIntent': function () {
    this.emit(':tell', 'Test Photo topics: ' + topics);
  }
}

exports.handler = (event, context, callback) => {
  getTopics(callback, function() {
    alexaFunction(event, context);
  });
};

function alexaFunction(event, context) {
  var alexa = Alexa.handler(event, context);
  alexa.registerHandlers(handlers);
  alexa.execute();
};

function getTopics(callback, alexaCallback) {
  setTimeout (function() {
    var params = {
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
