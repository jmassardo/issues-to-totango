const core = require('@actions/core');
const github = require('@actions/github');

try {
  // Fetch variables from the actions inputs
  const TOTANGO_API_URL = 'https://api.totango.com/api/v3/touchpoints/';
  const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
  const APP_TOKEN = core.getInput('APP_TOKEN');
  const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
  const TOUCHPOINT_TAGS = core.getInput('TOUCHPOINT_TAGS');
  const TOUCHPOINT_TYPE = core.getInput('TOUCHPOINT_TYPE');

  // Fetch the payload from the event
  const issue = github.context.payload.issue;
  console.log(`Issue num is: ${issue['number']}`);

  const comment = github.context.payload.comment;
  console.log(`eventName is: ${github.context.eventName}`);

  const event_action = github.context.payload.action;
  console.log(`Event Action is: ${event_action}`);

  var task_flag = false
  
  // Build payload body

  if (github.context.eventName === 'issues') {

    if (event_action === 'opened') {

      var subject = 'New Issue: ' + issue['title'];
      var body = `${issue['user']['login']} created a  new issue. ${issue['body']}. More info here: ${issue['html_url']}`;

    } else if (event_action === 'closed') {

      var subject = 'Issue #: ' + issue['title'] + ' was closed';
      var body = `${issue['user']['login']} closed an issue. ${issue['body']}. More info here: ${issue['html_url']}`;

    } else if (event_action === 'labeled') {

      var subject = 'Issue #: ' + issue['title'] + ' was labeled';
      var body = `${issue['user']['login']} labeled an issue. ${issue['body']}. More info here: ${issue['html_url']}`;
      const label = github.context.payload.label
      if (label['name'] === 'task') {
        task_flag = true
      }

    }

  } else if (github.context.eventName === 'issue_comment') {

    var subject = 'New comment on issue: ' + issue['number'];
    var body = `${comment['user']['login']} commented on issue #${issue['number']}. ${comment['body']}. More info here: ${issue['html_url']}`;

  } else {

    core.setFailed('Unsupported event type. Please use the  `issues` or `issue_comment` event type.');

  }

  // output the payload to the console so the user can see it
  console.log(`Touchpoint subject is: ${subject}`);
  console.log(`Touchpoint body is: ${body}`);

  // Build the POST Request
  var request = require('request');

  if (task_flag === true) {
    request.post('https://api.totango.com/api/v3/tasks', {
      headers: {
        'app-token': APP_TOKEN,
      },
      form: {
        account_id: ACCOUNT_ID,
        description: body,
        activity_type_id: ACTIVITY_TYPE,
        priority: 2,
        title: subject,
        status: 'open',
        due_date: '2023-1-4',
      },
    }, (error, response, body) => {
      // Output a message to the console and an Action output
/*       touchpoint_id = (JSON.parse(response.body))['note']['id'];
      console.log(`Successfully created touchpoint: ${touchpoint_id}`);
      core.setOutput('touchpoint_id', touchpoint_id); */
      console.log(response.statusCode);
    });
  } else {
    request.post(TOTANGO_API_URL, {
      headers: {
        'app-token': APP_TOKEN,
      },
      form: {
        account_id: ACCOUNT_ID,
        content: body,
        activity_type_id: ACTIVITY_TYPE,
        subject: subject,
        touchpointType: TOUCHPOINT_TYPE,
        touchpoint_tags: [ TOUCHPOINT_TAGS ],
      },
    }, (error, response, body) => {
      // Output a message to the console and an Action output
      touchpoint_id = (JSON.parse(response.body))['note']['id'];
      console.log(`Successfully created touchpoint: ${touchpoint_id}`);
      core.setOutput('touchpoint_id', touchpoint_id);
      console.log(response.statusCode);
    });
}

} catch (error) {
  core.setFailed(error.message);
}
