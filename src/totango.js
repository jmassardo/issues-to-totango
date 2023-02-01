const { core, github } = require('./github.js');
const request = require('request');
const showdown = require('showdown');

// Fetch variables from the actions inputs
const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
const APP_TOKEN = core.getInput('APP_TOKEN');
const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
const TOUCHPOINT_TAGS = core.getInput('TOUCHPOINT_TAGS');
const TOUCHPOINT_TYPE = core.getInput('TOUCHPOINT_TYPE');
const TASK_ASSIGNEE = core.getInput('TASK_ASSIGNEE');
const GITHUB_TOKEN = core.getInput('REPO_TOKEN');

// Create an authenticated GitHub client
const octokit = github.getOctokit(GITHUB_TOKEN);

// TODO: add support for using GitHub Action Variables in the below constants with documentation
const DEFAULT_PRIORITY = 2; // Indicates "Normal" priority for tasks;
const DEFAULT_TASK_ACTIVITY = 'support';
// where 12096e5 is the magic number for 14 days in milliseconds and the format is YYYY-MM-DD
const DEFAULT_DUE_DATE = new Date(Date.now() + 12096e5).toISOString().substring(0, 10);
const TOTANGO_TOUCHPOINTS_URL = 'https://api.totango.com/api/v3/touchpoints/';
const TOTANGO_TASK_URL = 'https://api.totango.com/api/v3/tasks';

//Add HTML comment to GitHub issue body
async function add_html_comment({issue, type, id}) {
  return new Promise((resolve, reject) => {
    try {
      octokit.rest.issues.update({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue['number'],
        body: `${issue['body']}
<!-- ${type}_ID: ${id} -->`,
      });
      console.log(`Updated issue ${issue['number']} with ${type}_ID: ${id}`);
      resolve();
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to create a touchpoint in Totango
async function create_touchpoint(subject, body) {
  console.log('Creating touchpoint...');
  return new Promise((resolve, reject) => {
    try {
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
        if (error) {
          core.setFailed(`Failed to create touchpoint: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to create touchpoint: ${response.statusCode}`);
        }

        // Output a message to the console and an Action output
        let touchpoint_id = (JSON.parse(response.body))['note']['id'];
        console.log(`Successfully created touchpoint: ${touchpoint_id}`);

        // Touchpoint id to github issue comment using function
        console.log('Commenting on github issue');
        core.setOutput('touchpoint_id', touchpoint_id);
        resolve(touchpoint_id);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to create a task in Totango
async function create_task(subject, body_array) {
  console.log('Creating task...');
  return new Promise((resolve, reject) => {
    try {
      request.post(TOTANGO_TASK_URL, {
        headers: {
          'app-token': APP_TOKEN,
        },
        form: {
          account_id: ACCOUNT_ID,
          assignee: TASK_ASSIGNEE,
          description: body_array[0],
          activity_type_id: DEFAULT_TASK_ACTIVITY,
          priority: body_array[1],
          title: subject,
          status: 'open',
          due_date: body_array[2],
        },
      }, (error, response, _body) => {
        if (error) {
          core.setFailed(`Failed to create task: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to create task: ${response.statusCode}`);
        }

        // Output a message to the console and an Action output
        let task_id = (JSON.parse(response.body))['id'];

        console.log(`Successfully created task: ${task_id}`);
        core.setOutput('task_id', task_id);
        resolve(task_id);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to convert markdown to text for cleaner visibility in Totango
function format_body(eventPayload, link, state, issue_number) {
  let converter = new showdown.Converter({
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

  console.log('Formatting body...');
  let user = eventPayload['user']['login'];
  let body = eventPayload['body'];

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

async function labeled({ issue, label }) {
  let subject = 'Issue #: ' + issue['title'] + ' was labeled';
  let body = `${issue['user']['login']} labeled an issue. ${issue['body']}. More info here: ${issue['html_url']}`;

  if (label['name'] === 'task') {
    let regex = /### Description\n\n(.*)|### Priority\n\n[1-3]|### Due Date\n\n([0-9]+(-[0-9]+)+)/g;
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

    let task_id = await create_task(subject, body_array);

    console.log('Commenting on github issue for task with id: ' + task_id);
    //sleep for 10s
    //this is a workaround for a race condition with applying both touchpoint and task labels
    await new Promise(r => setTimeout(r, 10000));
    await add_html_comment({
      issue: issue,
      type: 'task',
      id: task_id,
    });
  } else if (label['name'] === 'touchpoint') {
    // output the payload to the console so the user can see it
    console.log(`Touchpoint subject is: ${subject}`);
    console.log(`Touchpoint body is: ${body}`);
    let touchpoint_id = await create_touchpoint(subject, body);

    console.log('Commenting on github issue for touchpoint');
    await add_html_comment({
      issue: issue,
      type: 'touchpoint',
      id: touchpoint_id,
    });
  }
}

async function closed({ issue }) {
  // This function is not currently performing any actions
  // let subject = 'Issue #: ' + issue['title'] + ' was closed';
  // let body = format_body(issue, issue['html_url'], 'closed');
  console.log('Issue was closed');
  return new Promise((resolve, _reject) => {
    resolve();
  });
}

async function commented({ issue, comment }) {
  // This function is not currently performing any actions
  // let subject = 'Issue #: ' + issue['title'] + ' was commented on';
  // let body = format_body(comment, issue['html_url'], 'commented', issue['number']);
  console.log('Issue was commented on');
  return new Promise((resolve, _reject) => {
    resolve();
  });
}

// Exports for testing
const totangoPrivate = {
  add_html_comment,
  create_touchpoint,
  create_task,
  format_body,
};

module.exports = {
  totangoPrivate,
  labeled,
  closed,
  commented,
};
