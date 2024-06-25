import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './App.css';

const initialData = window.__INITIAL_DATA__;
const name = initialData.name;

ReactDOM.render(<App name={name} />, document.getElementById('root'));
