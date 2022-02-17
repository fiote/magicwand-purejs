# Magic Wand

### Description

A tool that analyzes an image pixel by pixel then calculates the area around the clicked position based on its color and the tolerance selected.

### Challenges Encountered

Reading the image pixels and checking if positions are similar enough was the easy part. Making it perform in an acceptable speed was way, way harder. The bigger the image, the slower it gets. That said, it should run just fine with anything smaller than 2000x2000. It was fun, tho!

### Technologies

Nothing fancy, just HTML5 canvas and typescript. All the code/logic (except for the <a target='_blank' href='https://github.com/antimatter15/rgb-lab'>comparing rgb</a> bit) was developed over the last few hours specifically for this test.

# See it Working

https://rawcdn.githack.com/fiote/magicwand/master/index.html