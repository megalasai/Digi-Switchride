package com.digiswitchride.customer.data

import com.google.gson.TypeAdapter
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.google.gson.stream.JsonWriter

class LenientDoubleAdapter : TypeAdapter<Double>() {
    override fun write(out: JsonWriter, value: Double?) {
        if (value == null) out.nullValue() else out.value(value)
    }

    override fun read(reader: JsonReader): Double {
        return when (reader.peek()) {
            JsonToken.NULL -> {
                reader.nextNull()
                0.0
            }
            JsonToken.NUMBER -> reader.nextDouble()
            JsonToken.STRING -> reader.nextString().trim().toDoubleOrNull() ?: 0.0
            else -> {
                reader.skipValue()
                0.0
            }
        }
    }
}

class LenientIntAdapter : TypeAdapter<Int>() {
    override fun write(out: JsonWriter, value: Int?) {
        if (value == null) out.nullValue() else out.value(value)
    }

    override fun read(reader: JsonReader): Int {
        return when (reader.peek()) {
            JsonToken.NULL -> {
                reader.nextNull()
                0
            }
            JsonToken.NUMBER -> reader.nextDouble().toInt()
            JsonToken.STRING -> reader.nextString().trim().toDoubleOrNull()?.toInt() ?: 0
            else -> {
                reader.skipValue()
                0
            }
        }
    }
}
