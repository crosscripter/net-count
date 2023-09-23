/*****************************************************************
 *
 *              ~~^#######1##5###3######^~~
 *                 ## ><> ## <><  <>< ##
 *              ~~~# N E T   C o u n t #~~~
 *                 ## <>< ## ><>  ><> ##
 *              ~~^######1##6##1##1#####^~~
 *
 *  " Simon Peter went up, and drew the net to land 
 *    full of great fishes, an HUNDRED and FIFTY and THREE: 
 *    and for all there were so many, yet was not the net broken."
 *                                 --John 21:11 (King James Bible) 
 *
 * File:    ./src/index.js
 * Created: 2023-09-18 11:15:01 CDT 
 * Author:  Michael Schutt (@crosscripter) 
 *
 * Usage:   A program to explore net count of occurrences of a list 
 *          of names within the Gospels to see the significance of 
 *          obtaining the same count as listed in the text, 153.
 *
 * Command-line usage:
 * $ netcount dataFile targetTotal minSize maxSize trialCount [-d] 
 * $ netcount names.csv 153 2 7 3 -d
 *
 *~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *     Built for our beloved fellow labourer Brandon Peterson
 *  May Christ enrich you with ever deeper knowledge of His Word
 *
 *  All Glory to God the Father and His Son Jesus Christ our Lord
 *  Absolutely No Rights Reserved, Michael Schutt 2023 - 2024  
 *          "freely ye have received, freely give" 
 *****************************************************************/


const { floor, random } = Math
const { log, time, timeEnd } = require('console')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')


/* Constants */
const MIN_SLOTS = 2
const MAX_SLOTS = 7
const TRIAL_COUNT = 3
const ENCODING = 'utf8'
const NAME_COL = 'Name'
const TARGET_TOTAL = 153
const TOTAL_COL = 'Gospels'
const BAR = '='.repeat(130)
const NEWLINES = /\r\n|\r|\n/
const DATA_FILE_PATH = './names.csv'

/**
 * Displays an error message on screen and exits program
 * @param {string} msg The error message to display
 */
const error = msg => log(`Error: ${msg}`, process.exit(1))

/**
 * Loads a data file into memory
 * @param {string} path The path to the data file to load as text
 * @param {string} encoding The file encoding to use, defaults to ENCODING (utf8-8)
 * @returns the text of the data file as a string
 * @note Hard exit if data file cannot be loaded from path given
 */
const load = (path, encoding=ENCODING) => {
    try { 
        return readFileSync(path, encoding)
    } catch (e) {
        log(`Error: Failed to load data file "${path}" (${encoding})\n`)
        process.exit(1) 
    }
}

/**
 * Transforms a CSV file's contents into a in memory model of the data (Array<Object>) 
 * @param {string} text The text contents of a file to transform into CSV format
 * @returns An array of objects representing each row built from the CSV text contents
 * @throws on no data, or missing header record
 */
const toCSV = text => {
    const { keys, fromEntries } = Object
    const lines = text.split(NEWLINES).filter(Boolean)
    if (!lines.length) throw `Error: At least one record required to build header`

    const [headerLine] = lines
    const cols = headerLine.split(',')
    const header = fromEntries(cols.map(col => [col, 0]))

    const records = lines.slice(1).map(line => {
        const cols = line.split(',')
        const rec = { ...header }
        cols.forEach((col, i) => rec[keys(rec)[i]] = /^\d+$/.test(col) ? parseFloat(col) : col) 
        return rec
    })

    return records 
} 

/**
 * Builds up a pool of values from the CSV data and creates one entry
 * for the corresponding occurrence in data. Returns an array of of all
 * entries with the given number of entries per occurrence 
 * @param {csvData} data The array of data models returns from the toCSV function [{...},]
 * @param {string} nameCol The column to pull the value data from in the model
 * @param {string} totalCol The column to pull the total data from in the model
 * @returns An entry pool with the number of ocurrences per value as an array of strings
 */
const getEntriesByTotal = (data, nameCol, totalCol) => {
    const entryPool = []

    data.map(({ [nameCol]: name, [totalCol]: total }) => {
        const entries = new Array(total).fill(name)
        entryPool.push(...entries)
    })

    return entryPool 
}

/**
 * Get a random number between min and max
 * @param {number} min The minumum random number to yield
 * @param {number} max The maximum (inclusive) random number to yield
 * @returns A random number between min and max (inclusive)
 */
const randomNumber = (min, max) => floor(random() * (max - min) + min)

/**
 * Fisher-Yates in place array shuffle algorithm 
 * See this page: https://bost.ocks.org/mike/shuffle/
 * @param {array} array An array of T elements to shuffle in place
 * @returns The original array shuffled IN PLACE
 */
const shuffle = array => {
  let t, i, m = array.length

  while (m) {
    i = floor(random() * m--)
    t = array[m]
    array[m] = array[i]
    array[i] = t
  }

  return array
}

/**
 * Generate a random array of selected element of a random (min - max) length 
 * @param {array<T>} sourceArray The source array of random elements to choose from
 * @param {number} min The minimum number of name slots to generate (must be 2 or greater)
 * @param {number} max The maximum number of name slots to generate (must be 2 or greater)
 * @returns A random array of min-max elements
 */
const randomArray = (sourceArray, min, max) => {
    const randomArray = []
    let randomElements = shuffle([...sourceArray])
    const randomCount = randomNumber(min, max)

    for (let i = 0; i < randomCount; i++) {
        const randomIndex = randomNumber(0, randomElements.length)
        const randomElement = randomElements[randomIndex]
        randomArray.push(randomElement)
        randomElements = shuffle(randomElements.filter(el => el !== randomElement))
    }

    return randomArray 
}

/**
 * Run trials of randomly selecting a pool of names of MIN_SLOTS to MAX_SLOTS length and
 * summing up the total mentions in the Gospels to object the TARGET_TOTAL (default 153)
 * Record the group names and totals in CSV format and export with details on time and 
 * totals required to obtain target match.
 * @param {string} dataFile The data file which was used as source to the totals
 * @param {csvData} data The data from the toCSV function as an Array<Object>
 * @param {string[]} pool An array of values to use as the pool in which to group from
 * @param {number} target The number of mentions we are trying to hit to end each trial
 * @param {number} min The minimum group size for each trial
 * @param {number} max The maximum group size for each trial
 * @returns Trial details with csv data and count of total trials 
 */
const runTrial = (dataFile, data, pool, target, min, max, trialCount) => {
    // Counters
    let tries = 0
    let total = 0 
    let nameCount = 0

    // Print header
    DEBUG && log(`${BAR}
${' '.repeat(130 / 2 - 10)} TRIAL LOG ${' '.repeat(130 / 2 - 10)}
${BAR}
Command: ${dataFile} ${target} ${min} ${max} ${trialCount} ${DEBUG ? '-d' : ''}
Data file: ${dataFile}, Encoding: ${ENCODING}, Min group size: ${min}, Max group size: ${max}, Name Pool size: ${pool.length}, Target value: ${target}
${BAR}`)

    // Start trials
    const csv = []
    const header = `Trial #, Group Size, Group Names, Total Mentions (Gospels), Total Breakdown`
    DEBUG && log(header)
    csv.push(header) 
    
    const trialId = ['TRIAL', pool.length, target].join('-')
    const { stringify: json } = JSON
    DEBUG && time(trialId)

    do {
        tries++
        const group = randomArray(pool, MIN_SLOTS, MAX_SLOTS)
        DEBUG && log(`\n\tGroup: ${group.join(', ')}`)
        nameCount += group.length

        // Get total mentions for each group entry from CSV data 
        const mentions = group.map(name => {
            const rec = data.find(({ [NAME_COL]: col }) => name === col)
            if (!rec) throw `Could not find corresponding mentions for Name "${name}" in CSV data!`
            DEBUG && log(`\t\tRecord ${json(rec['#'])} ${json(rec[NAME_COL])}: ${json(rec[TOTAL_COL])}`)
            return rec[TOTAL_COL]
        })

        total = mentions?.reduce((a, b) => a + b, 0) ?? 0

        const trial = { 
            total, 
            names: group,
            number: tries, 
            size: group.length, 
            id: `${trialId}-${tries}`
        }

        DEBUG && log(`\t\t\tTrial #${tries} => ${json(trial)}`)
        const trialNames = `"${trial.names.map(name => name.replace(/\,/g, '')).join(' ')}"`
        const record = `${trial.number}, ${trial.size}, ${trialNames}, ${trial.total}, (= ${mentions.join(' + ')})`
        DEBUG && log(record)
        csv.push(record)

    } while (total !== target) // Loop until we hit target total mentions

    // Footer
    DEBUG && log(`===============================================================================================================
TRIAL RESULTS: Total trial runs: ${tries} trial(s), Target value reached: ${target}, Total names: ${nameCount}`)
    DEBUG && timeEnd(trialId) 

    // Return details of trials we ran to obtain match
    return { id: trialId, csv, tries }
}

/*** MAIN PROGRAM ***/
const validate = (value, validator, msg) => {
    value = parseInt(value, 10) 
    if (isNaN(value) || !validator(value)) error(msg)
    return value
}

// Parse command-line args
const args = process.argv.slice(2)

if (!args.length) return log(`
            ~~^#######1##5###3######^~~
               ## ><> ## <><  <>< ##
            ~~~# N E T  C o u n t  #~~~
               ## <>< ## ><>  ><> ##
            ~~^######1##6##1##1#####^~~

Usage:   A program to explore net count of occurrences of a list 
         of names within the Gospels to see the significance of 
         obtaining the same count as listed in the text, 153.
 
$ netcount dataFile targetTotal minSize maxSize trialCount [-d] 
$ netcount names.csv 153 2 7 3 -d`)

let [
    dataFile=DATA_FILE_PATH, 
    target=TARGET_TOTAL, 
    min=MIN_SLOTS, 
    max=MAX_SLOTS,
    trialCount=TRIAL_COUNT,
    ...flags
] = args

// validate args
const DEBUG = flags.includes('-d')
min = validate(min, x => x >= 2, 'Min group size must be 2 or greater')
max = validate(max, x => x >= 2, `Max group size must be 2 or greater`)
target = validate(target, x => x > 0, `Target must be a positive integer value`)
trialCount = validate(trialCount, x => x > 0, `Trial count must be a positive integer value`)

// Load data into pool
const data = toCSV(load(dataFile))
const pool = getEntriesByTotal(data, NAME_COL, TOTAL_COL)


// Run trials
const trials = []
const trialsCSV = []
const ts = Number(new Date())
let dir = ''
for (let i = 0; i < trialCount; i++) {
    // Run trial
    const { id, csv, tries } = runTrial(dataFile, data, pool, target, min, max, trialCount)
    const [lastRow=''] = csv.slice(-1)
    if (trialsCSV.length === 0) trialsCSV.push(csv[0])
    trialsCSV.push(lastRow)
    // Write CSV
    dir = `./${id}-${ts}`
    if (!existsSync(dir)) mkdirSync(dir)
    writeFileSync(`${dir}/trial${i+1}.csv`, csv.join('\n'), ENCODING)
    // Add to average trials
    DEBUG && log(`Trial #${i + 1} took ${tries} tries to reach total of ${target} mentions`)
    trials.push(tries)
}


// Calculate average
const trialSum = trials.reduce((a, b) => a + b, 0) 
const avgTries = Math.floor(trialSum / trials.length)
const averageResults = `\n${BAR}\n${avgTries} tries on average required after ${trials.length} trial(s) ran to obtain total of ${target} mentions:
(${trials.join(' + ')} = ${trialSum} / ${trials.length} = ${avgTries})
`
log(averageResults)
trialsCSV.push(averageResults)

writeFileSync(`${dir}/trials.csv`, trialsCSV.join('\n'), ENCODING)
