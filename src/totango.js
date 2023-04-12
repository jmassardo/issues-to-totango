const { core, github } = require('./github.js');
const request = require('request');
const showdown = require('showdown');
const validator = require('validator');

// Fetch variables from the actions inputs
const ACCOUNT_ID = core.getInput('ACCOUNT_ID');
if (typeof ACCOUNT_ID !== 'string' || ACCOUNT_ID === '') {
  core.setFailed('ACCOUNT_ID is required and must be a string');
}
const APP_TOKEN = core.getInput('APP_TOKEN');
if (typeof APP_TOKEN !== 'string' || APP_TOKEN === '') {
  core.setFailed('APP_TOKEN is required and must be a string');
}
const ACTIVITY_TYPE = core.getInput('ACTIVITY_TYPE');
if (typeof ACTIVITY_TYPE !== 'string' || ACTIVITY_TYPE === '') {
  core.setFailed('ACTIVITY_TYPE is required and must be a string');
}
const TOUCHPOINT_TAGS = core.getInput('TOUCHPOINT_TAGS');
if (!validator.isUUID(TOUCHPOINT_TAGS)) {
  // We may have received a comma separated list of GUIDs so we need to check each one
  console.log('TOUCHPOINT_TAGS is not a valid GUID, checking for a comma separated list of GUIDs...');
  let tags = TOUCHPOINT_TAGS.split(',');
  for (let i = 0; i < tags.length; i++) {
    if (!validator.isUUID(tags[i])) {
      console.log(`TOUCHPOINT_TAGS is not a valid GUID: ${tags[i]}`);
      core.setFailed('TOUCHPOINT_TAGS must be a valid GUID or a comma separated list of valid GUIDs');
    }
  }
}
const TOUCHPOINT_TYPE = core.getInput('TOUCHPOINT_TYPE');
if (!validator.isUUID(TOUCHPOINT_TYPE)) {
  core.setFailed('TOUCHPOINT_TYPE must be a valid GUID');
}
const TASK_ASSIGNEE = core.getInput('TASK_ASSIGNEE');
if (!validator.isEmail(TASK_ASSIGNEE)) {
  core.setFailed('TASK_ASSIGNEE must be a valid email address');
}
const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
if (typeof GITHUB_TOKEN === 'undefined') {
  core.setFailed('GITHUB_TOKEN is required but not present.');
}

// TODO: add support for using GitHub Action Variables in the below constants with documentation
const DEFAULT_PRIORITY = 2; // Indicates "Normal" priority for tasks;
const DEFAULT_TASK_ACTIVITY = 'support';
// where 12096e5 is the magic number for 14 days in milliseconds and the format is YYYY-MM-DD
const DEFAULT_DUE_DATE = new Date(Date.now() + 12096e5).toISOString().substring(0, 10);
const TOTANGO_TOUCHPOINTS_URL = 'https://api.totango.com/api/v3/touchpoints/';
const TOTANGO_TASK_URL = 'https://api.totango.com/api/v3/tasks';
const TOTANGO_EVENTS_URL = 'https://api.totango.com/api/v2/events/?account_id=';

// Function to parse a string of comma separated values into an array
function parse_to_array(string) {
  try {
    return string.split(',').map((tag) => tag.trim());
  } catch (error) {
    console.log(error);
    core.setFailed(`Failed to parse string to array: ${error}`);
  }
}

// Get issue body
async function get_issue_body({issue}) {
  return new Promise((resolve, reject) => {
    try {
      // Create an authenticated GitHub client
      let octokit = github.getOctokit(GITHUB_TOKEN);
      octokit.rest.issues.get({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue['number'],
      }).then((response) => {
        resolve(response['data']['body']);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to fetch the details of a Totango Task by ID
async function get_task_by_id({id}) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Getting task by id: ${id}`);
      request.get(`${TOTANGO_TASK_URL}?id=${id}`, {
        headers: {
          'app-token': APP_TOKEN,
        },
      }, (error, response, _body) => {
        if (error) {
          core.setFailed(`Failed to get task by id: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to get task by id: ${response.statusCode}`);
        }

        let task = JSON.parse(response.body);

        task = task[0];

        console.log(`Successfully retrieved task: ${task['id']}`);
        resolve(task);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to determine if an issue has a Totango Task or Touchpoint ID from the issue body text and return the ID
function issue_has_totango_id({body}) {
  let regex = /<!-- (task|touchpoint)_ID: (\d+) -->/g;
  let matches = body.match(regex);
  if (matches) {
    let match = matches[0];
    let id = match.match(/\d+/g)[0];
    return {id};
  } else {
    return false;
  }
};

// Add HTML comment to GitHub issue body
async function add_html_comment({issue, type, id}) {
  return new Promise((resolve, reject) => {
    try {
      // Create an authenticated GitHub client
      let octokit = github.getOctokit(GITHUB_TOKEN);

      // If the type is a follow_up, update the comment with the follow_up_id
      if (type === 'follow_up') {
        let comment_id = issue['id'];
        octokit.rest.issues.updateComment({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          comment_id: comment_id,
          body: `${issue['body']}\n\n<!-- ${type}_ID: ${id} -->`,
        });
        console.log(`Updated comment ${comment_id} with ${type}_ID: ${id}`);
        resolve();
      } else {
        // call get_issue_body to get the issue body
        get_issue_body({issue}).then((body) => {

          octokit.rest.issues.update({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issue['number'],
            body: `${body}\n\n<!-- ${type}_ID: ${id} -->`,
          });
          console.log(`Updated issue ${issue['number']} with ${type}_ID: ${id}`);
          resolve();
        });
      }
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
          touchpoint_tags: parse_to_array(TOUCHPOINT_TAGS),
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

// Function to get the event_id from Totango for an extracted touchpoint ID from an issue comment.
function get_event(touchpoint_id) {
  console.log('Getting event id...');
  return new Promise((resolve, reject) => {
    try {
      request.get(TOTANGO_EVENTS_URL + ACCOUNT_ID,
        { headers: { 'app-token': APP_TOKEN } },
        function(err, res, body) {
          let results = (JSON.parse(body));
          let event_payload = results.filter((o) => o.type === 'note' && o.note_content.note_id === touchpoint_id);
          var event_id = event_payload[0].id;
          console.log('Event id:' + event_id);
          if (err) throw err;
          resolve(event_id);
        },
      );
    } catch (error) { console.log(error); reject(error); };
  });
}

// Function to edit/update a Touchpoint in github and sync the contents to Totango
async function edit_touchpoint(touchpoint_id, subject, body, event_id) {
  console.log('Editing Touchpoint...');
  return new Promise((resolve, reject) => {
    try {
      let url = TOTANGO_TOUCHPOINTS_URL + touchpoint_id;
      request.put(url,
        {
          headers: { 'app-token': APP_TOKEN }, form: {account_id: ACCOUNT_ID, note_id: touchpoint_id,
            event_id: event_id,
            content: body, activity_type_id: ACTIVITY_TYPE, subject: subject, touchpointType: TOUCHPOINT_TYPE, touchpoint_tags: TOUCHPOINT_TAGS,
          },
        }, (error, response, _body) => {
          if (error || response.statusCode < 200 || response.statusCode >= 300) {
            core.setOutput('Account ID', ACCOUNT_ID); core.setOutput('Touchpoint ID', touchpoint_id);
            core.setOutput('Touchpoint URL', url); core.setOutput('Request Body', body); core.setOutput('Response Body', response.body);
            core.setOutput('Totango Response', response);
            core.setFailed(`Failed to edit touchpoint: ${response.statusCode}`);
            core.setFailed('Error Details:', error);
            process.exit(1);
          }
          // Output a message to the console and an Action output
          resolve(touchpoint_id);
          console.log(`Successfully edited/synced touchpoint: ${touchpoint_id}`);
          core.setOutput('Touchpoint ID', touchpoint_id); core.setOutput(url);
        },
      );
    } catch (error) { console.log(error); reject(error); };
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
        } else {
          // Output a message to the console and an Action output
          let task_id = (JSON.parse(response.body))['id'];
          console.log(`Successfully created task: ${task_id}`);
          core.setOutput('task_id', task_id);
          resolve(task_id);
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to update a task in Totango
async function update_task(task_id, subject, body_array, issue) {
  console.log('Updating task...');
  console.log('Description: ' + body_array[0]);
  console.log('Priority: ' + body_array[1]);
  console.log('Due Date: ' + body_array[2]);
  return new Promise((resolve, reject) => {
    try {
      request.put(`${TOTANGO_TASK_URL}`, {
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
          status: issue['state'].toLowerCase(),
          id: task_id,
          due_date: body_array[2],
        },
      }, (error, response, _body) => {
        if (error) {
          core.setFailed(`Failed to update task: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to update task: ${response.statusCode}`);
          reject(`Failed to update task: ${response.statusCode}`);
        }

        // Output a message to the console and an Action output
        console.log(`Successfully updated task: ${task_id}`);
        core.setOutput('task_id', task_id);
        resolve(task_id);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}


// Function to close a task in Totango
async function close_task(task_id) {
  console.log('Closing task...');
  return new Promise((resolve, reject) => {
    try {
      request.put(`${TOTANGO_TASK_URL}`, {
        headers: {
          'app-token': APP_TOKEN,
        },
        form: {
          id: task_id,
          status: 'closed',
        },
      }, (error, response, _body) => {
        if (error) {
          core.setFailed(`Failed to close task: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to close task: ${response.statusCode}`);
          reject(`Failed to close task: ${response.statusCode}`);
        }

        // Output a message to the console and an Action output
        console.log(`Successfully closed task: ${task_id}`);
        resolve(task_id);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// Function to convert markdown to text for cleaner visibility in Totango
async function format_body(eventPayload, link, state, issue_number) {
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
  let subject = issue['title'];
  let body = await format_body(issue, issue['html_url'], 'labeled', issue['number']);
  if (label['name'] === 'task') {
    let body_array = await get_task_form_data({body});
    // check if task is already created for this issue (shouldn't be)
    let check_task_id = issue_has_totango_id({body});
    if (check_task_id) {
      console.log(`Task already exists for this issue ${check_task_id}`);
      return;
    }
    // create task
    let task_id = await create_task(subject, body_array);
    console.log('Commenting on github issue for task with id: ' + task_id);
    // sleep for 1s
    await new Promise(r => setTimeout(r, 1000));
    await add_html_comment({
      issue: issue,
      type: 'task',
      id: task_id,
    });
  } else if (label['name'] === 'touchpoint') {
    // output the payload to the console so the user can see it
    console.log(`Touchpoint subject is: ${subject}`);
    console.log(`Touchpoint body is: ${body}`);
    // check if touchpoint is already created for this issue (shouldn't be)
    let check_touchpoint_id = issue_has_totango_id({body});
    console.log(`Touchpoint id is: ${check_touchpoint_id}`);
    if (check_touchpoint_id) {
      console.log(`Touchpoint already exists for this issue ${check_touchpoint_id}`);
      return;
    }

    let touchpoint_id = await create_touchpoint(subject, body);

    console.log('Commenting on github issue for touchpoint');
    await add_html_comment({
      issue: issue,
      type: 'touchpoint',
      id: touchpoint_id,
    });
  }
}

// Function to edit a touchpoint in Totango
async function edited({ issue }){
  // check issue label for touchpoint or task
  let label = issue['labels'][0]['name'];
  let body = await format_body(issue, issue['html_url'], 'edited');
  let subject = issue['title'];
  if (label === 'touchpoint') {
    let tp_id = body.match(/touchpoint_ID: (\d+)/); // Fetches the first touchpoint ID from the body
    if (tp_id != null) {
      let array = [];
      var touchpoint_id = tp_id[1];
      console.log('Extracted body:' + body);
      console.log('Extracted Matching Touchpoint ID:' + touchpoint_id);
      await get_event(parseInt(touchpoint_id, 10)).then(value => array.push(value));
      console.log('Extracted Event ID:' + array[0]);
      // Calling edit touchpoint function
      let event_id = array[0];
      edit_touchpoint(touchpoint_id, subject, body, event_id);
    } else {
      core.setFailed(`Failed to find touchpoint ID in body: ${body}`);
    }
  } else {
    let tp_id = body.match(/task_ID: (\d+)/);
    if (tp_id != null) {
      var task_id = tp_id[1];
      let body_array = await get_task_form_data({body});
      console.log('Extracted body:' + body);
      console.log('Extracted Matching Task ID:' + task_id);
      await update_task(task_id, subject, body_array, issue);
    } else {
      core.setFailed(`Failed to find task ID in body: ${body}`);
    }
  }
  return new Promise((resolve, _reject) => { resolve(); });
}
async function get_task_form_data({ body }){
  let description_regex = /<h3 id="description">Description<\/h3>\s*<div>(.*)<\/div>/g;
  let priority_regex = /<h3 id="priority">Priority<\/h3>\s*<div>(.*)<\/div>/g;
  let duedate_regex = /<h3 id="duedate">Due Date<\/h3>\s*<(?:div|h2 id="\d{8}")>(\d{4}-\d{2}-\d{2})<\/(?:div|h2)>/g;
  let regex_array = [description_regex, priority_regex, duedate_regex];
  let temp_array;
  let body_array = [];
  regex_array.forEach((regex) => {
    while ((temp_array = regex.exec(body)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (temp_array.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      if (temp_array !== null) {
        let piece = temp_array[1].split('<\/');
        body_array.push(piece[0]);
      }
    }
  });
  if (body_array === []){
    body_array[0] = body;
    body_array[1] = DEFAULT_PRIORITY;
    body_array[2] = DEFAULT_DUE_DATE;
  }
  // find "Created by" and add to body_array
  let created_by_regex = /(<div>Created By:.*\s*.*)/g;
  let created_by = created_by_regex.exec(body);
  if (created_by !== null) {
    body_array[0] = body_array[0] + created_by[1];
  }
  return body_array;
}

// Function to create a follow up in Totango from an issue comment
async function commented({ issue, comment }) {
  // Check to see if the comment is from a bot
  if (comment['user']['login'] === 'github-actions[bot]') {
    return new Promise((resolve, _reject) => {
      resolve();
    });
  }
  // Check to see if the comment is from a user
  if (comment['user']['type'] === 'User') {
    let issue_body = issue['body'];
    let subject = issue['title'] + ' was commented on';
    let comment_body = await format_body(comment, issue['html_url'], 'commented', issue['number']);
    let tp_id = issue_body.match(/touchpoint_ID: (\d+)/); // Fetches the first touchpoint ID from the issue body
    if (tp_id != null) {
      var parent_id = tp_id[1];
      console.log(`Parent id is: ${parent_id}`);

      let follow_up_id = await create_follow_up(subject, comment_body, parent_id);
      console.log('Commenting on github issue for follow up id');
      await add_html_comment({
        issue: comment,
        type: 'follow_up',
        id: follow_up_id,
      });
    } else {
      core.setFailed(`Failed to find touchpoint ID in body: ${issue_body}`);
    }
    return new Promise((resolve, _reject) => {
      resolve();
    });
  }
}

// Function to create_follow_up in Totango
async function create_follow_up(subject, content, parent_id) {
  console.log('Creating Follow Up in Totango...');
  console.log('Subject: ' + subject);
  console.log('Content: ' + content);
  return new Promise((resolve, reject) => {
    try {
      request.post(`${TOTANGO_TOUCHPOINTS_URL}`, {
        headers: {
          'app-token': APP_TOKEN,
        },
        form: {
          account_id: ACCOUNT_ID,
          subject: subject,
          content: content,
          title: subject,
          parentId: parent_id,
          followUp: parent_id,
        },
      }, (error, response, _body) => {
        if (error) {
          core.setFailed(`Failed to create Follow Up: ${error}`);
          reject(error);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          core.setFailed(`Failed to create Follow Up: ${response.statusCode}`);
          reject(`Failed to create Follow Up: ${response.statusCode}`);
        }
        let follow_up_id = (JSON.parse(response.body))['note']['id'];
        // Output a message to the console and an Action output
        console.log(`Successfully created follow up: ${follow_up_id}`);
        core.setOutput('follow_up_id', follow_up_id);
        resolve(follow_up_id);
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

async function closed({ issue }) {
  console.log('Issue was closed');
  let body = issue['body'];
  // Check to see if the issue has a task associated with it
  // If it does, and the task is not already closed, close the task
  let task_id = issue_has_totango_id({body});
  console.log(`Task id before task status is: ${task_id}`);
  let task_status = await get_task_by_id({id: task_id}).then((task) => { return task['status']; });

  if (task_id && task_status !== 'closed') {
    await close_task(task_id);
  }
}

// Exports for testing
const totangoPrivate = {
  parse_to_array,
  add_html_comment,
  get_task_by_id,
  issue_has_totango_id,
  create_touchpoint,
  create_follow_up,
  edit_touchpoint,
  update_task,
  get_event,
  get_task_form_data,
  create_task,
  close_task,
  format_body,
  get_issue_body,
};

module.exports = {
  totangoPrivate,
  labeled,
  closed,
  commented,
  edited,
};
