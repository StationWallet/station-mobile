import React, { ReactElement } from 'react';
import MaterialIcons from '@react-native-vector-icons/material-design-icons';

// Updated version using the latest modular @react-native-vector-icons structure
// This uses the modern namespaced package structure
const Icon = (props: any): ReactElement => (
    <MaterialIcons {...props} />
);

export default Icon;
