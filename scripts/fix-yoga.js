const fs = require('fs')
const path = require('path')

const yogaFilePath = path.resolve(
  __dirname,
  '../node_modules/react-native/ReactCommon/yoga/yoga/Yoga.cpp'
)

const targetLine = 'node->getLayout().hadOverflow() |\n'
const replacementLine = 'node->getLayout().hadOverflow() ||\n'

fs.readFile(yogaFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading Yoga.cpp:', err)
    process.exit(1)
  }

  if (data.includes(targetLine)) {
    const updatedData = data.replace(targetLine, replacementLine)

    fs.writeFile(yogaFilePath, updatedData, 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing Yoga.cpp:', writeErr)
        process.exit(1)
      }
      console.log('Yoga.cpp successfully patched.')
    })
  } else {
    console.log('Yoga.cpp already patched or target line not found.')
  }
})
