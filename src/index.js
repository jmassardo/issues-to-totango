/* eslint-disable no-inner-declarations */
const { core, github } = require('./github.js');
const totango = require('./totango.js');

// Define supported event_name and event_action types
const SUPPORTED_EVENT_TYPES = ['issues', 'issue_comment'];
const SUPPORTED_EVENT_ACTIONS = ['labeled', 'closed', 'commented', 'created', 'edited'];

// Fail if a supported event type is not used
if (!SUPPORTED_EVENT_TYPES.includes(github.context.eventName)) {
  core.setFailed('Unsupported event type. Please use the `issues` or `issue_comment` event type.');
}

// Fail if a supported event action is not used
if (!SUPPORTED_EVENT_ACTIONS.includes(github.context.payload.action)) {
  core.setFailed('Unsupported event action. Please use the `labeled`, `closed`, `created`, `edited` or `commented` event action.');
}

// Update values based on payload data
const issue = github.context.payload.issue;
const event_action = github.context.payload.action;

console.log(`Issue num is: ${issue['number']}`);
console.log(`eventName is: ${github.context.eventName}`);
console.log(`Event Action is: ${event_action}`);

if (github.context.eventName === 'issues') {

  if (event_action === 'labeled') {
    let label = github.context.payload.label;

    let action = totango.labeled({
      issue: issue,
      label: label,
    });

    console.log(action);
  } else if (event_action === 'closed') {

    let action = totango.closed({
      issue: issue,
    });

    console.log(action);
  } else if (event_action === 'edited') {

    let action = totango.edited({
      issue: issue,
    });

    console.log(action);
  }
} else if (github.context.eventName === 'issue_comment') {

  let comment = github.context.payload.comment;

  let action = totango.commented({
    issue: issue,
    comment: comment,
  });

  console.log(action);
} else {

  core.setFailed('Unsupported event type. Please use the  `issues` or `issue_comment` event type.');
}
