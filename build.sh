#!/bin/sh

npm install
pip install psbs

ROOT_PATH=$PWD
BRIDGE_PATH=$PWD"/public/bridges"

echo "building bitsy games..."

cd $ROOT_PATH"/node_modules/bitsy-boilerplate"
for file in $BRIDGE_PATH/src/bitsy/*.bitsy; do 
    if [ -f "$file" ]; then 
        FILENAME=$(basename ${file})
        FILENAME_NOEX=${FILENAME%.*}
        BB_FILEPATH=input/$FILENAME
        rm $BRIDGE_PATH/$FILENAME_NOEX.html
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
        rm $BRIDGE_PATH/$FILENAME_NOEX.html
        tweego -o $BRIDGE_PATH/$FILENAME_NOEX.html $file
        cat $BRIDGE_PATH/src/bridge-common.html >> $BRIDGE_PATH/$FILENAME_NOEX.html
    fi 
done

echo "building downpour games..."
cd $ROOT_PATH
INDEX_PATH=$BRIDGE_PATH"/src/downpour/index.html"
for file in $BRIDGE_PATH/src/downpour/*.json; do 
    if [ -f "$file" ]; then
        FILENAME=$(basename ${file})
        FILENAME_NOEX=${FILENAME%.*}
        rm $BRIDGE_PATH/$FILENAME_NOEX.html
        echo "<script>let data = " >> $BRIDGE_PATH/$FILENAME_NOEX.html
        cat $file >> $BRIDGE_PATH/$FILENAME_NOEX.html
        echo "</script>" >> $BRIDGE_PATH/$FILENAME_NOEX.html
        cat $INDEX_PATH >> $BRIDGE_PATH/$FILENAME_NOEX.html
        cat $BRIDGE_PATH/src/bridge-common.html >> $BRIDGE_PATH/$FILENAME_NOEX.html
    fi 
done

echo "updating puzzlescript-ws"
cd $ROOT_PATH
rm -r $ROOT_PATH/public/puzzlescript-ws
git clone --depth=1 https://github.com/NEW-CYLANDIA/PuzzleScriptWebsocket.git
cd PuzzleScriptWebsocket
npm install
node compile.js
cat $BRIDGE_PATH/src/bridge-common.html >> bin/standalone_inlined.txt
cat $BRIDGE_PATH/src/bridge-common.html >> bin/standalone.html
mv bin $ROOT_PATH/public/puzzlescript-ws
cd ..
rm -rf PuzzleScriptWebsocket

echo "building puzzlescript games..."
cd $ROOT_PATH
PS_PATH=$BRIDGE_PATH"/src/puzzlescript"
cd $PS_PATH
for file in $PS_PATH/*.ps; do 
    if [ -f "$file" ]; then
        FILENAME=$(basename ${file})
        FILENAME_NOEX=${FILENAME%.*}
        rm $BRIDGE_PATH/$FILENAME_NOEX.html

        read -r LINE<$file
        TITLE=${LINE:6:50}
        TITLE="${TITLE//[$'\r']}"
        echo $TITLE

        psbs new --from-file $file $FILENAME_NOEX
        cp psbs_config_template.yml $FILENAME_NOEX/config.yml
        cd $FILENAME_NOEX
        psbs export
        cat "bin/$TITLE.html" >> $BRIDGE_PATH/$FILENAME_NOEX.html
        cd ..
    
        rm -r $FILENAME_NOEX
    fi 
done

cd $ROOT_PATH

echo "updating database"
node init.js