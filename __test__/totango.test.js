
const { totangoPrivate, } = require('../src/totango');
// Mock the github context
const github = require('@actions/github');

// Mock the totangoPrivate functions
jest.mock('../src/totango', () => ({
  totangoPrivate: {
    comment_gh_issue: jest.fn(),
    create_touchpoint: jest.fn(),
    create_task: jest.fn(),
    format_body: jest.fn(),
  },
}));

// Mock the github context
jest.mock('@actions/github', () => ({
  context: {
    payload: {
      issue: {
        title: 'Test Issue',
        html_url: 'https://api.totango.com/api/v3/touchpoints/',
        number: 1,
        labels: [ { name: 'task', }, ],
      },
      comment: {
        body: 'Test Comment',
      }
    },
  },
}));

// write test for comment_gh_issue
describe('comment_gh_issue', () => {
  it('should call comment_gh_issue', async () => {
    const { comment_gh_issue, } = totangoPrivate;
    await comment_gh_issue({
      issue: github.context.payload.issue,
      type: 'task',
      id: 1,
    });
    expect(comment_gh_issue).toHaveBeenCalled();
  });
});

// write test for create_touchpoint
describe('create_touchpoint', () => {
  it('should call create_touchpoint', async () => {
    const { create_touchpoint, } = totangoPrivate;
    await create_touchpoint('Test Subject', 'Test Body');
    expect(create_touchpoint).toHaveBeenCalled();
  });
});

// write test for create_task
describe('create_task', () => {
  it('should call create_task', async () => {
    const { create_task, } = totangoPrivate;
    await create_task('Test Subject', 'Test Body');
    expect(create_task).toHaveBeenCalled();
  });
});

// write test for format_body
describe('format_body', () => {
  it('should call format_body', async () => {
    const { format_body, } = totangoPrivate;
    await format_body(github.context.payload.issue, github.context.payload.issue.html_url, 'closed');
    expect(format_body).toHaveBeenCalled();
  });
});
