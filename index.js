const core = require('@actions/core');
const github = require('@actions/github');

try {
  // Fetch variables from the actions inputs
  const TOTANGO_API_URL = "https://api.totango.com/api/v3/touchpoints/";
  const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
  const APP_TOKEN = core.getInput('APP_TOKEN');
  const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
  const TOUCHPOINT_REASON = core.getInput('TOUCHPOINT_REASON');

  // Fetch the payload from the event
  const issue = github.context.payload.issue;
  console.log(`Issue num is: ${issue["number"]}`);

  //Build payload body
  var body = `${issue["user"]["login"]} created a  new issue. ${issue["body"]}. More info here: ${issue["html_url"]}`

  // Build the POST Request
  var request = require("request"); 

  request.post(TOTANGO_API_URL, {
    headers: {
      'app-token': APP_TOKEN,
    },
    form: {
      account_id: ACCOUNT_ID,
      content: body,
      activity_type_id: ACTIVITY_TYPE,
      subject: issue["title"],
      touchpointType: TOUCHPOINT_REASON,
    }
  }, (error, response, body) => {
    // handle success / failure ... 
    // Output a message to the console and an Action output
    touchpoint_id = (JSON.parse(response.body))["note"]["id"]
    console.log(`Successfully created touchpoint: ${touchpoint_id}`);
    core.setOutput("touchpoint_id", touchpoint_id);
    console.log(response.statusCode);
  });

} catch (error) {
  core.setFailed(error.message);
}