#!/bin/sh

npm install

ROOT_PATH=$PWD
BRIDGE_PATH=$PWD"/public/bridges"

echo "building bitsy games..."

cd $ROOT_PATH"/node_modules/bitsy-boilerplate"
for file in $BRIDGE_PATH/src/bitsy/*.bitsy; do 
    if [ -f "$file" ]; then 
        FILENAME=$(basename ${file})
        FILENAME_NOEX=${FILENAME%.*}
        BB_FILEPATH=input/$FILENAME
        cp $file $BB_FILEPATH
        cp $BRIDGE_PATH/src/bitsy/bitsy-common.js input/bitsy-common.js
        mv $BB_FILEPATH "input/gamedata.bitsy"
        mv input/bitsy-common.js "input/hacks.js"
        npm run build
        mv "output/index.html" $BRIDGE_PATH/$FILENAME_NOEX.html
        cat $BRIDGE_PATH/src/bridge-common.html >> $BRIDGE_PATH/$FILENAME_NOEX.html
        > "input/hacks.js"
    fi 
done

echo "building twine games..."
cd $ROOT_PATH
export TWEEGO_PATH=$BRIDGE_PATH"/src/twine/storyformats"
for file in $BRIDGE_PATH/src/twine/*.twee; do 
    if [ -f "$file" ]; then
        FILENAME=$(basename ${file})
        FILENAME_NOEX=${FILENAME%.*}
        tweego -o $BRIDGE_PATH/$FILENAME_NOEX.html $file
        cat $BRIDGE_PATH/src/bridge-common.html >> $BRIDGE_PATH/$FILENAME_NOEX.html
    fi 
done
