import React from 'react';
import styled, {ThemeProvider} from 'styled-components';
import {Button, pimTheme, CommonStyle} from "akeneo-design-system";

const MyApp = styled.div`
  ${CommonStyle}
`;

const App = ({name}) => {
  const handleClick = () => {
    alert('Yolo');
  };

  return (
    <ThemeProvider theme={pimTheme}>
      <MyApp>
        <Button level={'secondary'} onClick={handleClick}>{name}</Button>
      </MyApp>
    </ThemeProvider>
  );
};

export default App;
