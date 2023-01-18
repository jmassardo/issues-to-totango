const i2t = require('../index.js');
const { comment_gh_issue, create_touchpoint, create_task } = i2t.i2tPrivate;

let touchpoint_id = 'ID: abc123098';
let owner = 'ljenkins';
let repo = 'test';
let issue_number = 1;
let body = touchpoint_id;

describe('comment_gh_issue', () => {
  test('comment_gh_issue(touchpoint_id) should comment on issue with ID', () => {
    expect(touchpoint_id).toBe('ID: abc123098');
  });


  test('comment_gh_issue(touchpoint_id)) should contain payload for totango ', () => {
    expect(comment_gh_issue(touchpoint_id)).toEqual({
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      body: body,
    });
  });
});

describe('create_touchpoint', () => {
  it('should create a touchpoint', () => {
    create_touchpoint('test subject', 'test body');
  });
});

describe('create_task', () => {
  it('should create a task', () => {
    create_task('test subject', ['test body', 'high', '2020-12-12']);
  });
});
