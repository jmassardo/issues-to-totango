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

// Function to update a task in Totango
async function update_task(task_id, subject, body_array, issue) {
  console.log('Updating task...');
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
  let subject = issue['title'];
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
  let body = format_body(issue, issue['html_url'], 'edited');
  let subject = issue['title'];
  let tp_id = body.match(/touchpoint_ID: (\d+)/); // Fetches the first touchpoint ID from the body
  // If touchpoint_ID is not found in the body, search for task_ID instead
  let array = [];
  if (tp_id != null) {
    var touchpoint_id = tp_id[1];
    console.log('Extracted body:' + body);
    console.log('Extracted Matching Touchpoint ID:' + touchpoint_id);
    await get_event(parseInt(touchpoint_id)).then(value => array.push(value));
    console.log('Extracted Event ID:' + array[0]);
    // Calling edit touchpoint function
    let event_id = array[0];
    edit_touchpoint(touchpoint_id, subject, body, event_id);
    return new Promise((resolve, _reject) => { resolve(); });
    
  }
  else {
    let body_no_format = `${issue['user']['login']} edited an issue. ${issue['body']}. More info here: ${issue['html_url']}`;
    tp_id = body_no_format.match(/task_ID: (\d+)/);
    if (tp_id != null) {
      var task_id = tp_id[1];
      let regex = /### Description\s*(.*)|### Priority\s*([1-3])|### Due Date\s*([0-9]+(-[0-9]+)+)/g;
      console.log(regex.test(body_no_format));
      let body_array = [];
      let [_, description, priority, due_date] = regex.exec(body_no_format);
      let temp_array = body_no_format.match(regex);
      console.log(body_no_format)
      console.log(temp_array.length)
      console.log(temp_array);
      if(temp_array != null){
        if (temp_array.length === 3) { // regex should match 3 params w/ current issue form
          // for (let match of temp_array) {
          //   let piece = match.split('\n\n');
          //   body_array.push(piece[1]);
          // }
          body_array[0] = description;
          body_array[1] = priority;
          body_array[2] = due_date;
        } else { // set up default values
          body_array[0] = body_no_format;
          body_array[1] = DEFAULT_PRIORITY;
          body_array[2] = DEFAULT_DUE_DATE;
        }
      }
      console.log(body_array);
      console.log('Extracted body:' + body);
      console.log('Extracted Matching Task ID:' + task_id);
      //call edit task function
      update_task(task_id, subject, body_array, issue);
      return new Promise((resolve, _reject) => { resolve(); });
    }
    else {
    core.setFailed(`Failed to find touchpoint ID in body: ${body}`);
    }
  }
    
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

async function commented({ _issue, _comment }) {
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
  parse_to_array,
  add_html_comment,
  get_task_by_id,
  issue_has_totango_id,
  create_touchpoint,
  edit_touchpoint,
  update_task,
  get_event,
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
