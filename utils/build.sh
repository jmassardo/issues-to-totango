#!/bin/bash

npm install @actions/core
npm install @actions/github
ncc build index.js --license licenses.txt
rm -rf node_modules