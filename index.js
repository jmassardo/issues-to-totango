/* eslint-disable no-inner-declarations */
const core = require('@actions/core');
const github = require('@actions/github');
const showdown = require('showdown');
const request = require('request');

const converter = new showdown.Converter({
  ghMentions: true,
  strikethrough: true,
  underline: true,
  tables: true,
  literalMidWordUnderscores: true,
  simplifiedAutoLink: true,
  excludeTrailingPunctuationFromURLs: true,
  omitExtraWLInCodeBlocks: true,
  simpleLineBreaks: true,
});

try {
  // Constants
  const DEFAULT_PRIORITY = 2; // Indicates "Normal" priority for tasks;
  const DEFAULT_PRIORITY = 2; // Indicates "Normal" priority for tasks;
  const DEFAULT_TASK_ACTIVITY = 'support';
  // where 12096e5 is the magic number for 14 days in milliseconds and the format is YYYY-MM-DD
  // where 12096e5 is the magic number for 14 days in milliseconds and the format is YYYY-MM-DD
  const DEFAULT_DUE_DATE = new Date(Date.now() + 12096e5).toISOString().substring(0, 10);
  const TOTANGO_TOUCHPOINTS_URL = 'https://api.totango.com/api/v3/touchpoints/';
  const TOTANGO_TASK_URL = 'https://api.totango.com/api/v3/tasks';
  const TOTANGO_TASK_URL = 'https://api.totango.com/api/v3/tasks';

  // Fetch variables from the actions inputs
  const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
  const APP_TOKEN = core.getInput('APP_TOKEN');
  const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
  const TOUCHPOINT_TAGS = core.getInput('TOUCHPOINT_TAGS');
  const TOUCHPOINT_TYPE = core.getInput('TOUCHPOINT_TYPE');
  const TASK_ASSIGNEE = core.getInput('TASK_ASSIGNEE');
  const GITHUB_TOKEN = core.getInput('REPO_TOKEN');
  const octokit = github.getOctokit(GITHUB_TOKEN);
  // Fetch the payload from the event
  const issue = github.context.payload.issue;
  console.log(`Issue num is: ${issue['number']}`);

  const comment = github.context.payload.comment;
  console.log(`eventName is: ${github.context.eventName}`);

  const event_action = github.context.payload.action;
  console.log(`Event Action is: ${event_action}`);

  let subject, body;
  // Build payload body
  if (github.context.eventName === 'issues') {

    if (event_action === 'closed') {

      subject = 'Issue #: ' + issue['title'] + ' was closed';
      body = format_body(issue, issue['html_url'], 'closed');

    } else if (event_action === 'labeled') {

      subject = 'Issue #: ' + issue['title'] + ' was labeled';
      body = `${issue['user']['login']} labeled an issue. ${issue['body']}. More info here: ${issue['html_url']}`;
      // body = format_body(issue, issue['html_url'], 'labeled');
      let label = github.context.payload.label;

      if (label['name'] === 'task') {
        let regex = /### Description\n\n(.*)|### Priority\n\n[1-3]|### Due Date\n\n([0-9]+(-[0-9]+)+)/g;;
        //  Example of what a matching body should look like in request from Issue Form
        //  body = "### Description\n\nstuff stuff stuff\n\n### Priority\n\n1 (Low)\n\n### Due Date\n\n2024-01-01"
        let temp_array = body.match(regex);
        let body_array = [];

      if (temp_array.length === 3) { // regex should match 3 params w/ current issue form
        for (let match of temp_array) {
          let piece = match.split('\n\n');
          body_array.push(piece[1]);
        }
      } else { // set up default values
        body_array[0] = body;
        body_array[1] = DEFAULT_PRIORITY;
        body_array[2] = DEFAULT_DUE_DATE;
      }

        create_task(subject, body_array);
      } else if (label['name'] === 'touchpoint') {
        // output the payload to the console so the user can see it
        console.log(`Touchpoint subject is: ${subject}`);
        console.log(`Touchpoint body is: ${body}`);
        create_touchpoint(subject, body);
      }
    }

  } else if (github.context.eventName === 'issue_comment') {

    subject = 'New comment on issue: ' + issue['number'];
    body = format_body(comment, issue['html_url'], 'commented', issue['number']);

  } else {

    core.setFailed('Unsupported event type. Please use the  `issues` or `issue_comment` event type.');

  }


  // Comment on github issue with touchpoint id
  function comment_gh_issue(touchpoint_id) {
    octokit.rest.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue['number'],
      body: `ID: ${touchpoint_id}`,
    });
  }

  function create_touchpoint(subject, body) {
  function create_touchpoint(subject, body) {
    // Build the POST Request
    console.log('Creating touchpoint...');
    request.post(TOTANGO_TOUCHPOINTS_URL, {
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
    }, (error, response, _body) => {
      if (response.statusCode !== 200) {
        console.log(`Error Message: ${error}`);
        core.setFailed(`Failed to create touchpoint: ${response.statusCode}`);
      }
      // Output a message to the console and an Action output
      let touchpoint_id = (JSON.parse(response.body))['note']['id'];
      console.log(`Successfully created touchpoint: ${touchpoint_id}`);
      // Touchpoint id to github issue comment using function
      console.log('Commenting on github issue');
      comment_gh_issue(touchpoint_id);
      core.setOutput('touchpoint_id', touchpoint_id);
      console.log(response.statusCode);
    });

  }

  function create_task(subject, body_array) {
    console.log('Creating task...');
    request.post(TOTANGO_TASK_URL, {
      headers: {
        'app-token': APP_TOKEN,
      },
      form: {
        account_id: ACCOUNT_ID,
        assignee: TASK_ASSIGNEE, // TODO : get assignee from issue. If no assignee, get CSA/CSM from totango account and add
        description: body_array[0],
        activity_type_id: DEFAULT_TASK_ACTIVITY,
        priority: body_array[1],
        title: subject,
        status: 'open',
        due_date: body_array[2],
      },
    }, (error, response, _body) => {
      if (response.statusCode !== 200) {
        console.log(`Error Message: ${error}`);
        core.setFailed(`Failed to create task: ${response.statusCode}`);
      }
      // Output a message to the console and an Action output
      let task_id = (JSON.parse(response.body))['id'];
      console.log(`Successfully created task: ${task_id}`);
      core.setOutput('task_id', task_id);
      console.log('Commenting on github task');
      comment_gh_issue(task_id);
      console.log(response.statusCode);
    });
    // comment_gh_issue(task_id);
  }

  // Function to convert markdown to text for cleaner visibility in Totango
  function format_body(eventPayload, link, state, issue_number) {
    console.log('Formatting body...');
    const user = eventPayload['user']['login'];
    const body = eventPayload['body'];

    let signature, response, header, content, footer;

    switch (state) {
      case 'commented':
        signature = `${user} commented on issue #${issue_number}`;
        break;
      case 'opened':
        signature = `Created By: @${user}`;
        break;
      case 'closed':
        signature = `Closed By: @${user}`;
        break;
      case 'labeled':
        signature = `${user} labeled an issue #${issue_number}`;
        break;
      default:
        signature = `Created By: @${user}`;
    }
    response = `${body}\n----\n${signature}\nMore info here: ${link}`;
    header = '<div class="html-parser-container">';
    content = converter.makeHtml(response).replace(/(<p)/igm, '<div').replace(/<\/p>/igm, '</div><br />');
    footer = '</div>';
    return header + content + footer;
  }

} catch (error) {
  core.setFailed(error.message);
}
