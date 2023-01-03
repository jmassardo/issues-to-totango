const core = require('@actions/core');
const github = require('@actions/github');

try {
  // Constants
  const DEFAULT_PRIORITY = 2 //Indicates "Normal" priority for tasks;
  const DEFAULT_TASK_ACTIVITY = 'support';
  //where 12096e5 is the magic number for 14 days in milliseconds and the format is YYYY-MM-DD 
  const DEFAULT_DUE_DATE = new Date(Date.now() + 12096e5).toISOString().substring(0, 10);

  // Fetch variables from the actions inputs
  const TOTANGO_API_URL = 'https://api.totango.com/api/v3/touchpoints/';
  const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
  const APP_TOKEN = core.getInput('APP_TOKEN');
  const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
  const TOUCHPOINT_TAGS = core.getInput('TOUCHPOINT_TAGS');
  const TOUCHPOINT_TYPE = core.getInput('TOUCHPOINT_TYPE');
  const TOTANGO_USER_NAME = core.getInput('TOTANGO_USER_NAME');

  // Fetch the payload from the event
  const issue = github.context.payload.issue;
  console.log(`Issue num is: ${issue['number']}`);

  const comment = github.context.payload.comment;
  console.log(`eventName is: ${github.context.eventName}`);

  const event_action = github.context.payload.action;
  console.log(`Event Action is: ${event_action}`);
  
  // Build payload body
  if (github.context.eventName === 'issues') {

    if (event_action === 'opened') {

      var subject = 'New Issue: ' + issue['title'];
      var body = `${issue['user']['login']} created a  new issue. ${issue['body']}. More info here: ${issue['html_url']}`;

      // output the payload to the console so the user can see it
      console.log(`Touchpoint subject is: ${subject}`);
      console.log(`Touchpoint body is: ${body}`);

      create_touchpoint(subject, body)

    } else if (event_action === 'closed') {

      var subject = 'Issue #: ' + issue['title'] + ' was closed';
      var body = `${issue['user']['login']} closed an issue. ${issue['body']}. More info here: ${issue['html_url']}`;

    } else if (event_action === 'labeled') {

      var subject = 'Issue #: ' + issue['title'] + ' was labeled';
      var body = `${issue['user']['login']} labeled an issue. ${issue['body']}. More info here: ${issue['html_url']}`;
      var label = github.context.payload.label;

      if (label['name'] === 'task') {
        create_task(subject, body);
      }

    }

  } else if (github.context.eventName === 'issue_comment') {

    var subject = 'New comment on issue: ' + issue['number'];
    var body = `${comment['user']['login']} commented on issue #${issue['number']}. ${comment['body']}. More info here: ${issue['html_url']}`;

  } else {

    core.setFailed('Unsupported event type. Please use the  `issues` or `issue_comment` event type.');

  }
} catch (error) {
  core.setFailed(error.message);
}

function create_touchpoint(subject, body) {
    // Build the POST Request
    var request = require('request');

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

function create_task(subject, body) {
  var request = require('request');
  request.post('https://api.totango.com/api/v3/tasks', {
      headers: {
        'app-token': APP_TOKEN,
      },
      form: {
        account_id: ACCOUNT_ID,
        assignee: TOTANGO_USER_NAME, //TODO : get assignee from issue. If no assignee, get CSA/CSM from totango account and add
        description: body,
        activity_type_id: DEFAULT_TASK_ACTIVITY, 
        priority: DEFAULT_PRIORITY,
        title: subject,
        status: 'open',
        due_date: DEFAULT_DUE_DATE,
      },
    }, (error, response, body) => {
      // Output a message to the console and an Action output
      task_id = (JSON.parse(response.body))['id'];
      console.log(`Successfully created task: ${task_id}`);
      core.setOutput('task_id', task_id);
      console.log(response.statusCode);
      console.log(body);
    });
}
