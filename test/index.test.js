const index = require('../index');
const { comment_gh_issue, create_touchpoint, create_task } = index.i2tPrivate;

// mock github
const github = require('@actions/github');
jest.mock('@actions/github');
const issue = github.context.payload.issue;


describe('comment_gh_issue', () => {
  let touchpoint_id = 'abc123098';
  it('should comment on a github issue', () => {
    const issue_number = issue['number'];
    const repo = 'repo';
    const owner = 'owner  ';
    const body = `ID: ${touchpoint_id}`;
    const context = {
      repo: {
        owner: owner,
        repo: repo,
      },
    };
    github.context = context;
    const octokit = {
      rest: {
        issues: {
          createComment: jest.fn(),
        },
      },
    };
    github.getOctokit = jest.fn().mockReturnValue(octokit);
    comment_gh_issue(touchpoint_id);
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      body: body,
    });
  });
});


// test for create_task

const request = require('request');
jest.mock('request');

describe('create_task', () => {
  let subject = 'subject';
  let body_array = ['description', 'priority', 'due_date'];
  it('should create a task', () => {
    request.post = jest.fn();
    create_task(subject, body_array);
    expect(request.post).toHaveBeenCalledWith(
      'https://api.totango.com/v1/tasks',
      {
        headers: {
          'app-token  ': 'app-token', // TODO : get app token from totango account  and add to secrets
        },
        form: {
          account_id: 'account_id',
          assignee: 'assignee',
          description: 'description',
          activity_type_id: 'activity_type_id',
          priority: 'priority',
          title: 'subject',
          status: 'open',
          due_date: 'due_date',
        },
      },
      expect.any(Function)
    );
  });
});

// test for create_touchpoint

describe('create_touchpoint', () => {
  let subject = 'subject';
  let body = 'body';
  it('should create a touchpoint', () => {
    request.post = jest.fn();
    create_touchpoint(subject, body);
    expect(request.post).toHaveBeenCalledWith(
      'https://api.totango.com/v1/notes',
      {
        headers: {
          'app-token  ': 'app-token ',
        },  // TODO : get app token from totango account  and add to secrets
        form: {
          account_id: 'account_id',
          content: 'body',
          activity_type_id: 'activity_type_id',
          subject: 'subject',
          touchpointType: 'touchpointType',
          touchpoint_tags: ['touchpoint_tags'],
        },
      },
      expect.any(Function)
    );
  });
});
