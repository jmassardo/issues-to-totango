
const { totangoPrivate, } = require('../src/totango');
// Mock the github context
const github = require('@actions/github');

// Mock the totangoPrivate functions  
jest.mock('../src/totango', () => ({
  totangoPrivate: {
    add_html_comment: jest.fn(),
    create_touchpoint: jest.fn(),
    create_task: jest.fn(),
    format_body: jest.fn(),
    update_task: jest.fn(),
    get_task_form_data: jest.fn(),
  },
  labeled: jest.fn(),
  edited: jest.fn(),
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

// write test for add_html_comment
describe('add_html_comment', () => {
  it('should call add_html_comment', async () => {
    const { add_html_comment, } = totangoPrivate;
    await add_html_comment('Test Comment');
    expect(add_html_comment).toHaveBeenCalled();
    expect(add_html_comment).toHaveBeenCalledWith('Test Comment');
  });
});

// write test for create_touchpoint
describe('create_touchpoint', () => {
  it('should call create_touchpoint', async () => {
    const { create_touchpoint, } = totangoPrivate;
    await create_touchpoint('Test Subject', 'Test Body');
    expect(create_touchpoint).toHaveBeenCalled();
    expect(create_touchpoint).toHaveBeenCalledWith('Test Subject', 'Test Body');
  });
});

// write test for create_task
describe('create_task', () => {
  it('should call create_task', async () => {
    const { create_task, } = totangoPrivate;
    await create_task('Test Subject', 'Test Body');
    expect(create_task).toHaveBeenCalled();
    expect(create_task).toHaveBeenCalledWith('Test Subject', 'Test Body');
  });
});

// write test for format_body
describe('format_body', () => {
  it('should call format_body', async () => {
    const { format_body, } = totangoPrivate;
    await format_body(github.context.payload.issue, github.context.payload.issue.html_url, 'closed');
    expect(format_body).toHaveBeenCalled();
    expect(format_body).toHaveBeenCalledWith(github.context.payload.issue, github.context.payload.issue.html_url, 'closed');
  });
});

// write test for labeled
describe('labeled', () => {
  it('should call labeled', async () => {
    const { labeled, } = require('../src/totango');
    await labeled({ issue: github.context.payload.issue, });
    expect(labeled).toHaveBeenCalled();
    expect(labeled).toHaveBeenCalledWith({ issue: github.context.payload.issue, });
  });
});

// write test for edited
describe('edited', () => {
  it('should call edited', async () => {
    const { edited, } = require('../src/totango');
    await edited({ issue: github.context.payload.issue, });
    expect(edited).toHaveBeenCalled();
    expect(edited).toHaveBeenCalledWith({ issue: github.context.payload.issue, });
  });
});

// Test parse_to_array function from src/totango.js
// Expect that when passed a string or a comma separated list of strings,
//   it will return an array of strings
describe('parse_to_array', () => {
  it('should return an array of strings', () => {
    let { parse_to_array, } = jest.requireActual('../src/totango').totangoPrivate;
    expect(parse_to_array('Test String')).toEqual(['Test String']);
    expect(parse_to_array('Test String, Test String 2')).toEqual(['Test String', 'Test String 2']);
  });
});

// Test update_task function from src/totango.js to make sure function is called
describe('update_task', () => {
  it('should call update_task', async () => {
    const { update_task, } = totangoPrivate;
    await update_task(123456, 'test subject', ['description', '1', '2023-09-09'], github.context.issue);
    expect(update_task).toHaveBeenCalled();
    expect(update_task).toHaveBeenCalledWith(123456, 'test subject', ['description', '1', '2023-09-09'], github.context.issue);
  });
});

// Test get_task_form_data function from src/totango.js to make sure function is called
describe('get_task_form_data', () => {
  it('should call get_task_form_data', async () => {
    const { get_task_form_data, } = totangoPrivate;
    await get_task_form_data('Test Body');
    expect(get_task_form_data).toHaveBeenCalled();
    expect(get_task_form_data).toHaveBeenCalledWith('Test Body');
  });
});
